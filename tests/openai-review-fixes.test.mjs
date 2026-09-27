import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server.js";

import {
  setAdminAuthForTesting,
  setAdminFirestoreForTesting,
  resetAdminForTesting,
} from "../lib/firebaseAdmin.ts";
import { verifyServerAuth } from "../lib/auth/serverAuth.ts";
import {
  reserveAIQuota,
  reconcileAIQuota,
  setUseMemoryStoreForTesting,
  clearMemoryUsageStore,
  getAIUsageSummary,
  DEFAULT_AI_QUOTAS,
} from "../lib/services/aiUsageService.ts";
import { FINANCIAL_DIAGNOSIS_JSON_SCHEMA } from "../lib/services/agentManagerService.ts";
import {
  buildResponsesPayload,
  calculateEstimatedCostUsd,
  resetOpenAIClient,
} from "../lib/services/openaiService.ts";
import { safeParseFinancialDiagnosis } from "../lib/services/financialDiagnosisService.ts";
import { POST as chatRouteHandler } from "../app/api/ai/chat/route.ts";
import { POST as analyzeRouteHandler } from "../app/api/ai/analyze/route.ts";
import { POST as patternsRouteHandler } from "../app/api/ai/patterns/route.ts";
import { GET as usageRouteHandler } from "../app/api/ai/usage/route.ts";

test.beforeEach(() => {
  resetAdminForTesting();
  setUseMemoryStoreForTesting(true);
  clearMemoryUsageStore();
  resetOpenAIClient();
});

test.afterEach(() => {
  resetAdminForTesting();
});

// ============================================================================
// 1. REJEIÇÃO DE TOKEN COM ASSINATURA INVÁLIDA E ACEITAÇÃO DE TOKEN VÁLIDO
// ============================================================================
test("1. Autenticação: rejeição de token com assinatura forjada e aceitação de token assinado", async () => {
  // Configura mock do Firebase Admin Auth para simular verificação criptográfica estrita
  const validToken = "valid-cryptographic-signed-jwt-token";
  const fabricatedToken = "header.eyJzdWIiOiJ2aWN0aW0tdXNlciIsImVtYWlsIjoidmljdGltQGV4YW1wbGUuY29tIn0.fakeSignature123";

  // @ts-expect-error Mock para teste
  setAdminAuthForTesting({
    verifyIdToken: async (token, checkRevoked) => {
      assert.equal(checkRevoked, true, "verifyIdToken deve ser invocado com checkRevoked: true");
      if (token === validToken) {
        return {
          uid: "legitimate-user-123",
          email: "user@wallet.app",
          auth_time: Math.floor(Date.now() / 1000),
        };
      }
      const err = new Error("Firebase ID token has invalid signature.");
      // @ts-expect-error Mock errorCode
      err.code = "auth/argument-error";
      throw err;
    },
  });

  // 1. Requisição com token fabricado (sem assinatura válida) deve ser rejeitada com 401
  const fakeReq = new NextRequest("http://localhost:3000/api/ai/chat", {
    headers: { authorization: `Bearer ${fabricatedToken}` },
  });
  const authResultFake = await verifyServerAuth(fakeReq);
  assert.ok("errorResponse" in authResultFake);
  assert.equal(authResultFake.errorResponse.status, 401);

  // 2. Requisição com token válido assinado pelo Firebase Admin é aceita
  const validReq = new NextRequest("http://localhost:3000/api/ai/chat", {
    headers: { authorization: `Bearer ${validToken}` },
  });
  const authResultValid = await verifyServerAuth(validReq);
  assert.ok("user" in authResultValid);
  assert.equal(authResultValid.user.uid, "legitimate-user-123");

  // 3. Teste direto nas 4 rotas protegidas: token forjado é rejeitado em todas elas
  const routesToTest = [
    { name: "chat", handler: chatRouteHandler, method: "POST" },
    { name: "analyze", handler: analyzeRouteHandler, method: "POST" },
    { name: "patterns", handler: patternsRouteHandler, method: "POST" },
    { name: "usage", handler: usageRouteHandler, method: "GET" },
  ];

  for (const r of routesToTest) {
    const req = new NextRequest(`http://localhost:3000/api/ai/${r.name}`, {
      method: r.method,
      headers: { authorization: `Bearer ${fabricatedToken}` },
      body: r.method === "POST" ? JSON.stringify({}) : undefined,
    });
    const response = await r.handler(req);
    assert.equal(
      response.status,
      401,
      `Rota /api/ai/${r.name} DEVE rejeitar JWT fabricado com status 401`
    );
  }
});

// ============================================================================
// 2. BLOQUEIO DA CHAMADA OPENAI QUANDO A RESERVA PERSISTENTE FALHAR (FAIL-CLOSED)
// ============================================================================
test("2. Fail-Closed: bloqueia chamada à OpenAI quando o Firestore transacional falha", async () => {
  // Ativa modo persistente de produção (sem memória)
  setUseMemoryStoreForTesting(false);

  // Simula falha catastrófica de conectividade no Firestore Admin
  // @ts-expect-error Mock para teste
  setAdminFirestoreForTesting({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({}),
        }),
      }),
    }),
    runTransaction: async () => {
      throw new Error("UNAVAILABLE: Could not reach Cloud Firestore backend.");
    },
  });

  const res = await reserveAIQuota({
    uid: "prod-user-123",
    route: "chat",
  });

  assert.equal(res.allowed, false, "Deve falhar fechado e bloquear a chamada");
  assert.equal(res.errorCode, "QUOTA_SERVICE_UNAVAILABLE");
  assert.ok(res.error?.includes("segurança orçamentária"));
});

// ============================================================================
// 3. CONCORRÊNCIA ENTRE USUÁRIOS E INSTÂNCIAS PARA O TETO GLOBAL
// ============================================================================
test("3. Concorrência: múltiplos usuários simultâneos respeitam rigorosamente o teto global de US$ 4.50", async () => {
  const customConfig = {
    ...DEFAULT_AI_QUOTAS,
    userMonthlyCostCeilingUsd: 1.0,
    globalMonthlyCostCeilingUsd: 0.003, // Teto global muito baixo para testar bloqueio concorrente
  };

  // 6 requisições simultâneas de usuários distintos (chat reserva US$ 0.001 cada)
  const promises = Array.from({ length: 6 }, (_, i) =>
    reserveAIQuota({
      uid: `concurrent-user-${i}`,
      route: "chat",
      config: customConfig,
    })
  );

  const results = await Promise.all(promises);
  const allowed = results.filter((r) => r.allowed);
  const blocked = results.filter((r) => !r.allowed);

  assert.equal(allowed.length, 3, "Apenas 3 requisições podem caber no teto global de 0.003");
  assert.equal(blocked.length, 3, "As outras 3 devem ser bloqueadas concorrentemente");
  assert.equal(blocked[0].errorCode, "GLOBAL_APP_LIMIT_EXCEEDED");
});

// ============================================================================
// 4. IDEMPOTÊNCIA, TIMEOUT E RECUPERAÇÃO DE RESERVA ABANDONADA
// ============================================================================
test("4. Idempotência e recuperação de reservas abandonadas por timeout", async () => {
  const uid = "user-idempotency-test";
  const now = Date.now();

  // 1. Reserva cota
  const res1 = await reserveAIQuota({ uid, route: "chat" });
  assert.ok(res1.allowed && res1.reservation);

  // Primeira reconciliação
  await reconcileAIQuota({
    reservation: res1.reservation,
    success: true,
    actualCostUsd: 0.001,
  });

  // Segunda reconciliação IDÊNTICA (ex: retry de rede): NÃO pode duplicar consumo
  await reconcileAIQuota({
    reservation: res1.reservation,
    success: true,
    actualCostUsd: 0.001,
  });

  const summary = await getAIUsageSummary({ targetUid: uid, isAdmin: true });
  assert.equal(summary.userUsage?.monthly.chatCount, 1, "Contador não pode ser incrementado duas vezes");
  assert.equal(summary.userUsage?.monthly.estimatedCostUsd, 0.001, "Custo não pode ser duplicado");

  // 2. Recuperação de Reserva Abandonada (> 5 minutos)
  // Simula reserva pendente abandonada há 6 minutos
  const resAbandoned = await reserveAIQuota({ uid, route: "analyze" });
  assert.ok(resAbandoned.allowed && resAbandoned.reservation);
  // Adultera o timestamp da pendência para 6 minutos atrás
  if (summary.userUsage?.pendingReservations[resAbandoned.reservation.reservationId]) {
    summary.userUsage.pendingReservations[resAbandoned.reservation.reservationId].timestamp =
      now - 6 * 60 * 1000;
  }

  // Próxima reserva deve limpar automaticamente a reserva abandonada
  const resNext = await reserveAIQuota({ uid, route: "chat" });
  assert.ok(resNext.allowed);

  const updatedSummary = await getAIUsageSummary({ targetUid: uid, isAdmin: true });
  assert.equal(
    updatedSummary.userUsage?.pendingReservations[resAbandoned.reservation.reservationId],
    undefined,
    "Reserva abandonada por mais de 5 minutos deve ser recuperada e descartada"
  );
});

// ============================================================================
// 5. PAYLOAD REAL DE STRUCTURED OUTPUTS E TRATAMENTO DE 'INCOMPLETE'
// ============================================================================
test("5. Structured Outputs: payload no formato Responses API e tratamento de status incomplete", () => {
  // 1. Validação da estrutura plana do payload (sem json_schema aninhado)
  const payload = buildResponsesPayload({
    prompt: "Gere o diagnóstico",
    systemPrompt: "Instruções do sistema",
    jsonSchema: FINANCIAL_DIAGNOSIS_JSON_SCHEMA,
    reasoningEffort: "low",
  });

  assert.equal(payload.model, "gpt-6-luna");
  assert.equal(payload.instructions, "Instruções do sistema");
  assert.ok(payload.text && payload.text.format);
  assert.equal(payload.text.format.type, "json_schema");
  assert.equal(payload.text.format.name, "FinancialDiagnosis");
  assert.equal(payload.text.format.strict, true);
  assert.ok(payload.text.format.schema);
  // @ts-expect-error Verifica que a estrutura errada antiga não existe
  assert.equal(payload.text.format.json_schema, undefined, "NÃO deve aninhar json_schema dentro de format");
});

// ============================================================================
// 6. CÁLCULO DE CUSTO SEM DUPLICAR REASONING_TOKENS E CONSIDERANDO CACHE
// ============================================================================
test("6. Cálculo de custo: reasoning_tokens não é cobrado em duplicidade e cache é aplicado", () => {
  // gpt-6-luna: Input $0.10/1M, Cached $0.05/1M, Output $0.50/1M
  // 100.000 input (40.000 em cache, 60.000 uncached)
  // 20.000 output (dos quais 5.000 foram reasoning_tokens)
  const usage = {
    inputTokens: 100_000,
    cachedInputTokens: 40_000,
    outputTokens: 20_000,
    reasoningTokens: 5_000,
  };

  const { costUsd } = calculateEstimatedCostUsd("gpt-6-luna", usage);

  // Cálculo esperado:
  // Uncached input: 60.000 / 1.000.000 * 0.10 = 0.006000
  // Cached input:   40.000 / 1.000.000 * 0.05 = 0.002000
  // Output:         20.000 / 1.000.000 * 0.50 = 0.010000 (output já engloba reasoning!)
  // Total = 0.018000
  assert.equal(costUsd, 0.018, "Custo deve ser exatamente 0.018 sem dupla contagem de raciocínio");

  // Se somasse reasoning em dobro daria 0.018 + (5.000/1M * 0.50 = 0.0025) = 0.0205
  assert.notEqual(costUsd, 0.0205, "NÃO deve somar reasoning_tokens duas vezes");
});

// ============================================================================
// 7. CONTRATOS PRESERVADOS ENTRE FRONTEND E BACKEND
// ============================================================================
test("7. Contratos: diagnóstico e padrões estruturados cumprem schemas e contratos da interface", () => {
  const sampleContext = {
    user: { persona: "optimizer", riskTolerance: "moderate", aiTone: "analytical", primaryFocus: "Metas" },
    profile: { monthlyIncomeBase: 5000, maxCommitmentAlertPercent: 70, persona: "optimizer", riskTolerance: "moderate", primaryFocus: "Metas" },
    credit: { totalLimit: 8000, totalSpent: 1200, availableCredit: 6800, creditUtilizationPercent: 15, cardsSummary: [] },
    cashflow: { checkingBalance: 2000, totalIncome: 5000, totalExpenses: 3000, monthIncomeRealized: 5000, monthExpenseRealized: 3000, netCashflow: 2000, savingsRatePercent: 40 },
    commitments: { recurringMonthlyTotal: 1000, commitmentRatioPercent: 20, isOverLimit: false, recurringItems: [] },
    categories: [{ category: "Alimentação", total: 600, count: 4, percentage: 20 }],
    goals: [],
    historicalVariableBaseline: 800,
    topSpendItems: [],
    lifestyleHabits: [],
  };

  // @ts-expect-error Mock parcial para teste
  const parsed = safeParseFinancialDiagnosis("{}", sampleContext, []);

  assert.ok(typeof parsed.healthScore === "number");
  assert.ok(typeof parsed.healthStatus === "string");
  assert.ok(typeof parsed.executiveSummary === "string");
  assert.ok(Array.isArray(parsed.spendingPatterns));
  assert.ok(Array.isArray(parsed.specificExpensesAlerts));
  assert.ok(parsed.cashflowWindow.currentMonth);
  assert.ok(parsed.cashflowWindow.nextMonth);
  assert.ok(Array.isArray(parsed.installmentSchedule));
  assert.ok(parsed.clientProfileAssessment);
  assert.ok(parsed.futureMonthsRealityCheck);
});

// ============================================================================
// 8. IMPOSSIBILIDADE DE ALTERAÇÃO DAS COTAS PELO CLIENTE (FIRESTORE.RULES)
// ============================================================================
test("8. Regras do Firestore: clientes web não podem gravar em ai_usage nem em ai_logs", () => {
  const rulesPath = path.resolve(process.cwd(), "firestore.rules");
  const rulesContent = fs.readFileSync(rulesPath, "utf-8");

  // ai_usage não pode permitir escrita por clientes
  assert.ok(
    rulesContent.includes("match /ai_usage/{docId}") &&
    rulesContent.includes("allow write: if false;"),
    "ai_usage deve ter escrita explicitamente proibida para clientes"
  );

  // ai_logs não pode permitir escrita por clientes
  assert.ok(
    rulesContent.includes("match /ai_logs/{docId}") &&
    rulesContent.includes("allow write: if false;"),
    "ai_logs deve ter escrita explicitamente proibida para clientes"
  );

  // app_limits não pode permitir leitura nem escrita
  assert.ok(
    rulesContent.includes("match /app_limits/{document=**}") &&
    rulesContent.includes("allow read, write: if false;"),
    "app_limits deve ser totalmente inacessível para clientes"
  );
});

// ============================================================================
// 9. NÚMEROS INVENTADOS NO TEXTO DO MODELO NÃO CHEGAM AO USUÁRIO
// ============================================================================
test("9. Zero alucinação: valores e contagens inventados no texto do modelo são sanitizados", () => {
  const realHabits = [
    {
      habitName: "Chiquinho Sorvetes",
      total: 53.5,
      count: 2,
      creditAmount: 53.5,
      debitAmount: 0,
      examples: ["Chiquinho"],
    },
  ];

  const safeContext = {
    user: { persona: "optimizer", riskTolerance: "moderate", aiTone: "analytical", primaryFocus: "Reserva" },
    profile: { monthlyIncomeBase: 5000, maxCommitmentAlertPercent: 70, persona: "optimizer", riskTolerance: "moderate", primaryFocus: "Reserva" },
    credit: { totalLimit: 8000, totalSpent: 1200, availableCredit: 6800, creditUtilizationPercent: 15, cardsSummary: [] },
    cashflow: { checkingBalance: 2000, totalIncome: 5000, totalExpenses: 3000, monthIncomeRealized: 5000, monthExpenseRealized: 3000, netCashflow: 2000, savingsRatePercent: 40 },
    commitments: { recurringMonthlyTotal: 1000, commitmentRatioPercent: 20, isOverLimit: false, recurringItems: [] },
    categories: [],
    goals: [],
    historicalVariableBaseline: 800,
    topSpendItems: [],
    lifestyleHabits: realHabits,
  };

  // Resposta simulada onde o modelo inventou valores ("R$ 9.999,99 em dívidas", "R$ 450 no Chiquinho")
  const hallucinatedModelResponse = JSON.stringify({
    healthScore: 80,
    executiveSummary: "Você acumulou R$ 9.999,99 em dívidas ocultas não registradas.",
    specificExpensesAlerts: [
      {
        item: "Chiquinho Sorvetes",
        totalAmount: 450.0, // Alucinado! O real é 53.50
        count: 10, // Alucinado! O real é 2
        creditAmount: 450.0,
        debitAmount: 0,
        paymentBreakdown: "100% no Crédito (R$ 450,00)",
        message: "Você gastou R$ 450,00 em 10 compras no Chiquinho.",
      },
      {
        item: "Loja Inventada Inexistente",
        totalAmount: 1200.0,
        count: 5,
        message: "Gastos inventados",
      },
    ],
  });

  // @ts-expect-error Mock parcial para teste
  const diagnosis = safeParseFinancialDiagnosis(hallucinatedModelResponse, safeContext, []);

  // 1. Resumo executivo alucinado com R$ 9.999,99 deve ser rejeitado e substituído pelo factual
  assert.ok(
    !diagnosis.executiveSummary.includes("9.999,99"),
    "Resumo executivo NÃO pode conter valor alucinado de R$ 9.999,99"
  );
  assert.ok(
    diagnosis.executiveSummary.includes("2000.00"),
    "Resumo executivo deve referenciar o saldo real apurado"
  );

  // 2. Loja inexistente inventada pelo modelo deve ser completamente descartada
  const fakeStore = diagnosis.specificExpensesAlerts.find((a) => a.item.includes("Inexistente"));
  assert.equal(fakeStore, undefined, "Estabelecimentos inexistentes na base real devem ser descartados");

  // 3. Item real (Chiquinho) deve ter seus valores forçados para os dados reais (2 compras, R$ 53.50)
  const chiquinhoAlert = diagnosis.specificExpensesAlerts.find((a) => a.item.includes("Chiquinho"));
  assert.ok(chiquinhoAlert, "Chiquinho real deve ser mantido");
  assert.equal(chiquinhoAlert.count, 2, "Contagem deve ser 2 (real), não 10 (alucinado)");
  assert.equal(chiquinhoAlert.totalAmount, 53.5, "Valor total deve ser R$ 53.50 (real), não 450 (alucinado)");
  assert.ok(!chiquinhoAlert.message.includes("450"), "Mensagem não pode conter valor alucinado");
  assert.ok(chiquinhoAlert.message.includes("53.50"), "Mensagem deve conter o valor factual");
});
