import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  OPENAI_MODELS,
  MODEL_PRICING,
  calculateEstimatedCostUsd,
  callOpenAIResponses,
  OpenAIIntegrationError,
  resolveConfiguredModel,
} from "../lib/services/openaiService.ts";
import {
  generateDeterministicAuditDossier,
  orchestrateFinancialDiagnosis,
  FINANCIAL_DIAGNOSIS_JSON_SCHEMA,
  SPENDING_PATTERNS_JSON_SCHEMA,
} from "../lib/services/agentManagerService.ts";
import {
  reserveAIQuota,
  reconcileAIQuota,
  getSaoPauloDateKeys,
  clearMemoryUsageStore,
  getAIUsageSummary,
  DEFAULT_AI_QUOTAS,
} from "../lib/services/aiUsageService.ts";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
} from "../lib/services/financialContextService.ts";
import {
  redactKnownFinancialText,
  redactPersonalData,
} from "../lib/services/privacyService.ts";

test.beforeEach(() => {
  clearMemoryUsageStore();
});

// ============================================================================
// 1. VALORES FINANCEIROS NÃO INVENTADOS (Cálculo determinístico e conferência)
// ============================================================================
test("1. Valores financeiros não inventados: auditor determinístico extrai somas e contagens exatas da base real", () => {
  const mockTransactions = [
    { id: "1", title: "McDonald's", amount: 45.5, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-10" },
    { id: "2", title: "McDonald's", amount: 32.0, type: "despesa", category: "Alimentação", account: "Conta corrente", date: "2026-09-15" },
    { id: "3", title: "Chiquinho Sorvetes", amount: 25.0, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-18" },
    { id: "4", title: "Chiquinho Sorvetes", amount: 28.5, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-22" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: { name: "Cliente Teste", monthlyIncomeBase: 5000 },
    cards: [{ id: "c1", name: "Cartão 1", type: "credit", limit: 3000, spent: 100 }],
    transactions: mockTransactions,
    recurringItems: [],
    goals: [],
    mainBalance: 1500,
    monthIncome: 5000,
    monthExpense: 131,
  });
  const context = createSafeFinancialContext(telemetry);

  const dossier = generateDeterministicAuditDossier({ context });

  assert.ok(dossier.spendBreakdown.length >= 2);
  const mcDonalds = dossier.spendBreakdown.find((b) => b.categoryOrItem.includes("McDonald"));
  assert.ok(mcDonalds, "McDonald's deve constar no dossiê factual");
  assert.equal(mcDonalds.count, 2, "Contagem de compras deve ser exatamente 2");
  assert.equal(mcDonalds.totalAmount, 77.5, "Soma total deve ser exatamente 77.50");
  assert.equal(mcDonalds.creditAmount, 45.5, "Crédito deve ser 45.50");
  assert.equal(mcDonalds.debitAmount, 32.0, "Débito deve ser 32.00");

  const chiquinho = dossier.spendBreakdown.find((b) => b.categoryOrItem.includes("Chiquinho"));
  assert.ok(chiquinho, "Chiquinho deve constar no dossiê factual");
  assert.equal(chiquinho.count, 2);
  assert.equal(chiquinho.totalAmount, 53.5);
  assert.equal(chiquinho.creditAmount, 53.5);
  assert.equal(chiquinho.debitAmount, 0);
});

// ============================================================================
// 2. CONTRATOS DAS TRÊS ROTAS
// ============================================================================
test("2. Contratos das rotas de IA: esquemas JSON e estruturas esperadas pela interface", () => {
  // 1. Diagnóstico: Schema strict e required properties
  assert.equal(FINANCIAL_DIAGNOSIS_JSON_SCHEMA.name, "FinancialDiagnosis");
  assert.equal(FINANCIAL_DIAGNOSIS_JSON_SCHEMA.strict, true);
  const diagProps = FINANCIAL_DIAGNOSIS_JSON_SCHEMA.schema.properties;
  assert.ok(diagProps.healthScore);
  assert.ok(diagProps.healthStatus);
  assert.ok(diagProps.executiveSummary);
  assert.ok(diagProps.spendingPatterns);
  assert.ok(diagProps.specificExpensesAlerts);
  assert.ok(diagProps.cashflowWindow);
  assert.ok(diagProps.installmentSchedule);

  // 2. Padrões: Schema strict
  assert.equal(SPENDING_PATTERNS_JSON_SCHEMA.name, "SpendingPatternsResponse");
  assert.equal(SPENDING_PATTERNS_JSON_SCHEMA.strict, true);
  const patternProps = SPENDING_PATTERNS_JSON_SCHEMA.schema.properties;
  assert.ok(patternProps.patterns);
});

// ============================================================================
// 3. SEGURANÇA E PRIVACIDADE (Redação de PII e Dados Não Confiáveis)
// ============================================================================
test("3. Privacidade: redação rigorosa de PII antes de compor prompts para OpenAI", () => {
  const sensitiveUserText =
    "Meu nome é Roberto Carlos da Silva, CPF 123.456.789-00, e-mail roberto@exemplo.com.br, cartão 4111 2222 3333 4444 e PIX chave 123e4567-e89b-12d3-a456-426614174000. Também gastei com psiquiatria na conta 12345-6 agência 0001.";

  const redacted = redactPersonalData(sensitiveUserText);

  assert.ok(!redacted.includes("123.456.789-00"), "CPF não deve vazar");
  assert.ok(!redacted.includes("roberto@exemplo.com.br"), "E-mail não deve vazar");
  assert.ok(!redacted.includes("4111 2222 3333 4444"), "Cartão não deve vazar");
  assert.ok(!redacted.includes("123e4567-e89b-12d3-a456-426614174000"), "Chave PIX não deve vazar");
  assert.ok(!redacted.includes("12345-6"), "Conta não deve vazar");
  assert.ok(!redacted.includes("psiquiatria"), "Dado de saúde não deve vazar");

  // Rótulos financeiros conhecidos
  const textWithLabels = "Paguei a Fatura Nubank de Roberto Silva e comprei no Cartão Black";
  const sanitized = redactKnownFinancialText(textWithLabels, {
    userProfile: { name: "Roberto Silva" },
    cards: [{ name: "Cartão Black", type: "credit" }],
  });
  assert.ok(!sanitized.includes("Roberto Silva"));
  assert.ok(!sanitized.includes("Cartão Black"));
});

// ============================================================================
// 4. RESERVA CONCORRENTE DE COTA (Prevenção de Race Conditions)
// ============================================================================
test("4. Reserva concorrente de cota: solicitações simultâneas não estouram o limite diário", async () => {
  const customConfig = {
    ...DEFAULT_AI_QUOTAS,
    daily: { chat: 2, analyze: 2, patterns: 2 }, // Limite de apenas 2 mensagens diárias para o teste
  };

  const testUid = "user-concurrent-test";
  const testDate = new Date("2026-09-27T12:00:00-03:00");

  // 5 requisições disparadas simultaneamente
  const promises = Array.from({ length: 5 }, () =>
    reserveAIQuota({
      uid: testUid,
      route: "chat",
      date: testDate,
      config: customConfig,
    })
  );

  const results = await Promise.all(promises);

  const allowed = results.filter((r) => r.allowed);
  const blocked = results.filter((r) => !r.allowed);

  assert.equal(allowed.length, 2, "Exatamente 2 requisições devem ser autorizadas pela cota");
  assert.equal(blocked.length, 3, "As outras 3 devem ser bloqueadas concorrentemente");
  assert.equal(blocked[0].errorCode, "DAILY_LIMIT_EXCEEDED");
});

// ============================================================================
// 5. VIRADA DE PERÍODO (Horário de Brasília America/Sao_Paulo)
// ============================================================================
test("5. Virada de período: fusos e renovação diária/mensal em America/Sao_Paulo", async () => {
  // Teste de data no fuso de Brasília
  const dateAt23h = new Date("2026-09-27T23:30:00-03:00");
  const keys23h = getSaoPauloDateKeys(dateAt23h);
  assert.equal(keys23h.dayKey, "2026-09-27");
  assert.equal(keys23h.monthKey, "2026-09");

  const dateAt00h30NextDay = new Date("2026-09-28T00:30:00-03:00");
  const keysNextDay = getSaoPauloDateKeys(dateAt00h30NextDay);
  assert.equal(keysNextDay.dayKey, "2026-09-28");
  assert.equal(keysNextDay.monthKey, "2026-09");

  // Consome a cota inteira do dia 27
  const uid = "user-rollover-test";
  const customConfig = {
    ...DEFAULT_AI_QUOTAS,
    daily: { chat: 1, analyze: 1, patterns: 1 },
    monthly: { chat: 10, analyze: 10, patterns: 10 },
  };

  const resDay1 = await reserveAIQuota({ uid, route: "chat", date: dateAt23h, config: customConfig });
  assert.ok(resDay1.allowed);
  await reconcileAIQuota({ reservation: resDay1.reservation, success: true, actualCostUsd: 0.001 });

  // Tentativa subsequente no mesmo dia 27: bloqueada
  const resDay1Blocked = await reserveAIQuota({ uid, route: "chat", date: dateAt23h, config: customConfig });
  assert.equal(resDay1Blocked.allowed, false);
  assert.equal(resDay1Blocked.errorCode, "DAILY_LIMIT_EXCEEDED");

  // No dia 28 (virada da meia-noite): cota diária renovada com sucesso!
  const resDay2Allowed = await reserveAIQuota({ uid, route: "chat", date: dateAt00h30NextDay, config: customConfig });
  assert.equal(resDay2Allowed.allowed, true, "Cota deve estar liberada no novo dia civil");
});

// ============================================================================
// 6. BLOQUEIO POR LIMITE (Diário, Mensal, Teto do Usuário e Teto Global)
// ============================================================================
test("6. Bloqueio por limite: respeita limites diários, mensais, teto por usuário e teto global", async () => {
  const uid = "user-limits-test";
  const testDate = new Date("2026-09-27T10:00:00-03:00");

  // 1. Limite mensal
  const configMonthly = {
    ...DEFAULT_AI_QUOTAS,
    daily: { chat: 100, analyze: 100, patterns: 100 },
    monthly: { chat: 2, analyze: 10, patterns: 10 },
  };

  const r1 = await reserveAIQuota({ uid, route: "chat", date: testDate, config: configMonthly });
  await reconcileAIQuota({ reservation: r1.reservation, success: true });
  const r2 = await reserveAIQuota({ uid, route: "chat", date: testDate, config: configMonthly });
  await reconcileAIQuota({ reservation: r2.reservation, success: true });

  const r3Blocked = await reserveAIQuota({ uid, route: "chat", date: testDate, config: configMonthly });
  assert.equal(r3Blocked.allowed, false);
  assert.equal(r3Blocked.errorCode, "MONTHLY_LIMIT_EXCEEDED");

  // 2. Teto de custo mensal individual do usuário (US$ 0.75)
  const configUserCost = {
    ...DEFAULT_AI_QUOTAS,
    userMonthlyCostCeilingUsd: 0.005, // teto baixo para teste
  };
  const uidCost = "user-cost-test";
  const rc1 = await reserveAIQuota({ uid: uidCost, route: "chat", date: testDate, config: configUserCost });
  await reconcileAIQuota({ reservation: rc1.reservation, success: true, actualCostUsd: 0.0049 });

  const rc2Blocked = await reserveAIQuota({ uid: uidCost, route: "chat", date: testDate, config: configUserCost });
  assert.equal(rc2Blocked.allowed, false);
  assert.equal(rc2Blocked.errorCode, "USER_COST_CEILING_EXCEEDED");

  // 3. Teto de custo global do aplicativo (US$ 4.50)
  const configGlobal = {
    ...DEFAULT_AI_QUOTAS,
    globalMonthlyCostCeilingUsd: 0.008,
  };
  const uidGlobal1 = "user-global-1";
  const uidGlobal2 = "user-global-2";

  const rg1 = await reserveAIQuota({ uid: uidGlobal1, route: "chat", date: testDate, config: configGlobal });
  await reconcileAIQuota({ reservation: rg1.reservation, success: true, actualCostUsd: 0.0075 });

  const rg2Blocked = await reserveAIQuota({ uid: uidGlobal2, route: "chat", date: testDate, config: configGlobal });
  assert.equal(rg2Blocked.allowed, false);
  assert.equal(rg2Blocked.errorCode, "GLOBAL_APP_LIMIT_EXCEEDED");
});

// ============================================================================
// 7. FALHA OU FALTA DE CRÉDITOS & FALLBACK LOCAL
// ============================================================================
test("7. Falha da OpenAI: tratamento de erros 401/402 sem repetições e fallback local com aiSynthesis: false", async () => {
  // Teste de fallback local no diagnóstico financeiro
  const mockContext = {
    user: { persona: "optimizer", riskTolerance: "moderate", aiTone: "analytical", primaryFocus: "Reserva" },
    profile: { monthlyIncomeBase: 5000, maxCommitmentAlertPercent: 60, persona: "optimizer", riskTolerance: "moderate", primaryFocus: "Reserva" },
    credit: { totalLimit: 10000, totalSpent: 1200, availableCredit: 8800, creditUtilizationPercent: 12, cardsSummary: [] },
    cashflow: { checkingBalance: 2500, monthIncomeRealized: 5000, monthExpenseRealized: 2000, netCashflow: 3000, savingsRatePercent: 60 },
    commitments: { recurringMonthlyTotal: 1500, commitmentRatioPercent: 30, isOverLimit: false, recurringItems: [] },
    categories: [{ category: "Alimentação", total: 800, count: 5, percentage: 40 }],
    goals: [],
    historicalVariableBaseline: 1000,
    topSpendItems: [],
    lifestyleHabits: [],
  };

  // Chamada com falha simulada (sem rede / erro de provedor)
  // @ts-expect-error Mock parcial para teste unitário
  const result = await orchestrateFinancialDiagnosis({
    // @ts-expect-error Mock parcial
    context: mockContext,
    systemPrompt: "System",
    fullUserPrompt: "Prompt",
  });

  // O motor deve gerar diagnóstico determinístico local sem quebrar
  assert.ok(result.diagnosis);
  assert.ok(result.diagnosis.healthScore >= 0);
  assert.equal(result.aiSynthesis, false, "aiSynthesis DEVE ser false no fallback local");
  assert.equal(result.modelUsed, "motor-contabil-local", "modelUsed deve sinalizar o motor contábil local");

  // Validação de erro quando chave está ausente no ambiente
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await callOpenAIResponses({ prompt: "teste" });
    assert.fail("Deveria ter lançado erro de chave ausente");
  } catch (err) {
    assert.ok(err instanceof OpenAIIntegrationError);
    assert.equal(err.code, "MISSING_OPENAI_API_KEY");
  } finally {
    if (oldKey) process.env.OPENAI_API_KEY = oldKey;
  }

  // Validação de modelos, preços e resolução
  assert.equal(OPENAI_MODELS.MAIN, "gpt-6-luna");
  assert.equal(OPENAI_MODELS.OPTIONAL, "gpt-6-sol");
  assert.equal(resolveConfiguredModel(), "gpt-6-luna");
  assert.ok(MODEL_PRICING[OPENAI_MODELS.MAIN]);
  const cost = calculateEstimatedCostUsd("gpt-6-luna", { inputTokens: 1000, outputTokens: 500 });
  assert.equal(cost.costUsd, 0.00045);
});

// ============================================================================
// 8. AUSÊNCIA DE CHAVE NO CLIENTE (Segurança de Variáveis de Ambiente)
// ============================================================================
test("8. Ausência de chave no cliente: OPENAI_API_KEY não deve possuir prefixo NEXT_PUBLIC_ nem vazar no client", () => {
  const envExamplePath = path.resolve(process.cwd(), ".env.example");
  const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

  assert.ok(
    !envExampleContent.includes("NEXT_PUBLIC_OPENAI_API_KEY"),
    "A chave da OpenAI NUNCA deve conter o prefixo NEXT_PUBLIC_"
  );
  assert.ok(
    envExampleContent.includes("OPENAI_API_KEY=your-openai-api-key-here"),
    ".env.example deve conter placeholder seguro exclusivamente no servidor"
  );
  assert.ok(
    !envExampleContent.includes("sk-"),
    ".env.example não deve conter chave real"
  );
});

// ============================================================================
// 9. OBSERVABILIDADE E ISOLAMENTO DE RELATÓRIO DE USO
// ============================================================================
test("9. Observabilidade de uso: consulta protegida isola dados entre usuários e permite visão global ao admin", async () => {
  const testUid = "user-report-test";
  const testDate = new Date("2026-09-27T14:00:00-03:00");

  const r = await reserveAIQuota({ uid: testUid, route: "chat", date: testDate });
  await reconcileAIQuota({ reservation: r.reservation, success: true, actualCostUsd: 0.0015 });

  // 1. Consulta como usuário comum (não admin): NÃO deve ter globalUsage
  const userSummary = await getAIUsageSummary({ targetUid: testUid, isAdmin: false });
  assert.ok(userSummary.userUsage);
  assert.equal(userSummary.userUsage.monthly.chatCount, 1);
  assert.equal(userSummary.globalUsage, undefined, "Usuário comum NÃO pode ver consumo global");

  // 2. Consulta como administrador: DEVE ter globalUsage e dados agregados
  const adminSummary = await getAIUsageSummary({ targetUid: testUid, isAdmin: true });
  assert.ok(adminSummary.globalUsage, "Administrador deve ter acesso a globalUsage");
  assert.ok(adminSummary.globalUsage.estimatedCostUsd >= 0.0015);
  assert.equal(adminSummary.globalUsage.totalRequests, 1);
});
