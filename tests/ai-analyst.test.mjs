import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_CASCADE } from "../lib/services/geminiService.ts";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  normalizeFinancialCategory,
  simulatePurchaseImpact,
  buildFinancialAnalystSystemPrompt,
} from "../lib/services/financialContextService.ts";
import {
  redactKnownFinancialText,
  redactPersonalData,
} from "../lib/services/privacyService.ts";

test("MODEL_CASCADE contém exatamente os 8 modelos na ordem requisitada", () => {
  const expectedOrder = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
  ];

  assert.deepEqual(MODEL_CASCADE, expectedOrder);
});

test("synthesizeFinancialTelemetry calcula métricas consolidadas corretamente", () => {
  const mockCards = [
    {
      id: "card-1",
      name: "Nubank Ultra",
      brand: "Mastercard",
      type: "credit",
      limit: 5000,
      spent: 1500,
      closingDay: 5,
      dueDay: 12,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
    {
      id: "card-2",
      name: "Santander Elite",
      brand: "Visa",
      type: "credit",
      limit: 10000,
      spent: 2000,
      closingDay: 15,
      dueDay: 22,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
  ];

  const mockTransactions = [
    { id: "tx-1", title: "Supermercado", amount: 600, type: "despesa", category: "Alimentação", account: "Nubank", date: "2026-09-05" },
    { id: "tx-2", title: "Restaurante", amount: 200, type: "despesa", category: "Alimentação", account: "Nubank", date: "2026-09-10" },
    { id: "tx-3", title: "Cinema", amount: 150, type: "despesa", category: "Lazer", account: "Nubank", date: "2026-09-12" },
    { id: "tx-4", title: "Salário", amount: 8000, type: "receita", category: "Renda", account: "Conta principal", date: "2026-09-05" },
  ];

  const mockRecurring = [
    { id: "rec-1", title: "Aluguel", amount: 2500, dueDay: 10, account: "Conta principal", category: "Moradia", active: true },
    { id: "rec-2", title: "Academia", amount: 150, dueDay: 15, account: "Nubank Ultra", category: "Saúde", active: true },
  ];

  const mockGoals = [
    { id: "goal-1", title: "Reserva de Emergência", category: "Segurança", current: 15000, target: 30000, deadline: "2026-12-31" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Arthur",
      email: "arthur@test.com",
      role: "User",
      avatarInitials: "AT",
      monthlyIncomeBase: 10000,
      currency: "BRL",
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "analytical",
      maxCommitmentAlertPercent: 60,
      primaryFocus: "Atingir reserva de emergência",
    },
    cards: mockCards,
    transactions: mockTransactions,
    recurringItems: mockRecurring,
    goals: mockGoals,
    mainBalance: 4500,
    monthIncome: 8000,
    monthExpense: 3450,
  });

  // Verificações de Cartão
  assert.equal(telemetry.credit.totalLimit, 15000);
  assert.equal(telemetry.credit.totalSpent, 3500);
  assert.equal(telemetry.credit.availableCredit, 11500);
  assert.equal(telemetry.credit.creditUtilizationPercent, 23);

  // Verificações de Comprometimento (Recorrentes R$ 2.650 + Cartões R$ 3.500 = R$ 6.150 / R$ 10.000 = 62%)
  assert.equal(telemetry.commitments.recurringMonthlyTotal, 2650);
  assert.equal(telemetry.commitments.commitmentRatioPercent, 62);
  assert.equal(telemetry.commitments.isOverLimit, true); // 62% > 60%

  // Verificações de Categorias
  assert.equal(telemetry.categories[0].category, "Alimentação");
  assert.equal(telemetry.categories[0].total, 800);
  assert.equal(telemetry.categories[1].category, "Lazer");

  // Verificações de Metas
  assert.equal(telemetry.goals[0].progressPercent, 50);
  assert.equal(telemetry.goals[0].gap, 15000);
});

test("simulatePurchaseImpact avalia compra à vista com saldo suficiente e insuficiente", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Arthur",
      email: "a@a.com",
      role: "",
      avatarInitials: "A",
      monthlyIncomeBase: 5000,
      currency: "BRL",
      riskTolerance: "moderate",
      aiTone: "direct",
      maxCommitmentAlertPercent: 60,
      primaryFocus: "Economia",
    },
    cards: [],
    transactions: [],
    recurringItems: [],
    goals: [],
    mainBalance: 2000,
    monthIncome: 5000,
    monthExpense: 2000,
  });

  // Compra segura (Saldo restante 1.700 > 750 reserva)
  const safeSim = simulatePurchaseImpact(
    { amount: 300, method: "cash" },
    telemetry,
    []
  );
  assert.equal(safeSim.after.checkingBalance, 1700);
  assert.equal(safeSim.verdict, "safe");

  // Compra em alerta (Saldo restante 600 < 750 reserva mínima de 15%)
  const warningSim = simulatePurchaseImpact(
    { amount: 1400, method: "cash" },
    telemetry,
    []
  );
  assert.equal(warningSim.after.checkingBalance, 600);
  assert.equal(warningSim.verdict, "warning");

  // Compra crítica que estoura o saldo (fica negativa)
  const overdraftSim = simulatePurchaseImpact(
    { amount: 2500, method: "cash" },
    telemetry,
    []
  );
  assert.equal(overdraftSim.after.checkingBalance, -500);
  assert.equal(overdraftSim.verdict, "critical");
});

test("simulatePurchaseImpact avalia compra parcelada no crédito e limite de cartão", () => {
  const mockCards = [
    {
      id: "card-nubank",
      name: "Nubank",
      brand: "Mastercard",
      type: "credit",
      limit: 3000,
      spent: 1000,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Arthur",
      email: "a@a.com",
      role: "",
      avatarInitials: "A",
      monthlyIncomeBase: 5000,
      currency: "BRL",
      riskTolerance: "moderate",
      aiTone: "analytical",
      maxCommitmentAlertPercent: 50,
      primaryFocus: "Segurança",
    },
    cards: mockCards,
    transactions: [],
    recurringItems: [],
    goals: [],
    mainBalance: 2000,
    monthIncome: 5000,
    monthExpense: 1000,
  });

  // Compra de R$ 1.200 em 6x de R$ 200 no Nubank (Limite restante era 2.000 -> passa para 800)
  const simResult = simulatePurchaseImpact(
    { amount: 1200, method: "credit", installments: 6, cardId: "card-nubank" },
    telemetry,
    mockCards
  );

  assert.equal(simResult.monthlyInstallmentAmount, 200);
  assert.equal(simResult.after.cardAvailableLimit, 800);
  assert.equal(simResult.verdict, "safe");
  assert.equal(simResult.cardName, "Cartão 1");
  assert.ok(!simResult.impactSummary.includes("Nubank"));

  // Compra que excede o limite restante de R$ 2.000
  const overLimitSim = simulatePurchaseImpact(
    { amount: 2500, method: "credit", installments: 10, cardId: "card-nubank" },
    telemetry,
    mockCards
  );

  assert.equal(overLimitSim.verdict, "critical");
});

test("buildFinancialAnalystSystemPrompt incorpora arquétipo e tom da IA", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Camila",
      email: "c@c.com",
      role: "",
      avatarInitials: "C",
      monthlyIncomeBase: 12000,
      currency: "BRL",
      persona: "guardian",
      riskTolerance: "low",
      aiTone: "collaborative",
      maxCommitmentAlertPercent: 45,
      primaryFocus: "Preservação patrimonial",
    },
    cards: [],
    transactions: [],
    recurringItems: [],
    goals: [],
    mainBalance: 8000,
    monthIncome: 12000,
    monthExpense: 4000,
  });

  const safeContext = createSafeFinancialContext(telemetry);
  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("Arquetipo: GUARDIAN"));
  assert.ok(prompt.includes("Tom: Colaborativo"));
  assert.ok(!prompt.includes("Camila"));
  assert.ok(!prompt.includes("c@c.com"));
  assert.ok(prompt.includes("R$ 12000.00"));
});

test("redactPersonalData remove identificadores pessoais e normaliza espaços", () => {
  const input = `
    CPF 123.456.789-09, e-mail pessoa.teste+wallet@example.com,
    telefone (11) 98765-4321, CEP 01310-100,
    cartão 4111 1111 1111 1111 e CVV: 123.
  `;

  const redacted = redactPersonalData(input);

  assert.equal(
    redacted,
    "CPF [CPF REMOVIDO], e-mail [E-MAIL REMOVIDO], telefone [TELEFONE REMOVIDO], CEP [CEP REMOVIDO], cartão [CARTÃO REMOVIDO] e [DADO REMOVIDO]."
  );
});

test("redactPersonalData preserva valores monetários, datas e números de parcelas", () => {
  const input = "Compra de R$ 1.234,56 em 12 parcelas em 20/09/2026 (12x de R$ 102,88).";
  assert.equal(redactPersonalData(input), input);
});

test("createSafeFinancialContext pseudonimiza cartões, metas, recorrências e contas", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Marina Confidencial",
      email: "marina@example.com",
      role: "User",
      avatarInitials: "MC",
      monthlyIncomeBase: 9000,
      currency: "BRL",
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "analytical",
      maxCommitmentAlertPercent: 55,
      primaryFocus: "Quitar dívida de familiar identificado",
    },
    cards: [
      {
        id: "credit-1",
        name: "Banco Real Black da Marina",
        brand: "Visa",
        type: "credit",
        limit: 8000,
        spent: 2000,
        closingDay: 8,
        dueDay: 15,
        colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
      },
      {
        id: "credit-2",
        name: "Cartão Viagem Particular",
        brand: "Mastercard",
        type: "credit",
        limit: 4000,
        spent: 500,
        closingDay: 18,
        dueDay: 25,
        colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
      },
    ],
    transactions: [
      { id: "tx-1", title: "Consulta com pessoa", amount: 300, type: "despesa", category: "Categoria da Família Silva", account: "Banco Real Black da Marina", date: "2026-09-01" },
      { id: "tx-2", title: "Mercado", amount: 700, type: "despesa", category: "Supermercado", account: "Conta Família", date: "2026-09-02" },
    ],
    recurringItems: [
      { id: "rec-1", title: "Terapia de João", amount: 300, account: "Banco Real Black da Marina", category: "Saúde & Bem-estar", dueDay: 10, active: true },
      { id: "rec-2", title: "Ajuda para Maria", amount: 200, account: "Conta Família", category: "Categoria secreta", dueDay: 20, active: true },
    ],
    goals: [
      { id: "goal-1", title: "Casa da Marina", category: "Moradia", current: 10000, target: 50000, deadline: "2027-12-31" },
      { id: "goal-2", title: "Viagem para Ana", category: "Lazer", current: 2500, target: 5000 },
    ],
    mainBalance: 6000,
    monthIncome: 9000,
    monthExpense: 1000,
  });

  const safeContext = createSafeFinancialContext(telemetry);

  assert.deepEqual(
    safeContext.credit.cardsSummary.map((card) => card.alias),
    ["Cartão 1", "Cartão 2"]
  );
  assert.deepEqual(
    safeContext.goals.map((goal) => goal.alias),
    ["Meta 1", "Meta 2"]
  );
  assert.equal(safeContext.commitments.recurringItems[0].paymentMethod, "Cartão 1");
  assert.equal(safeContext.commitments.recurringItems[1].paymentMethod, "Conta corrente");
  assert.equal(safeContext.commitments.recurringItems[0].category, "Saúde");
  assert.equal(safeContext.commitments.recurringItems[1].category, "Outros");
  assert.equal(safeContext.categories.find((item) => item.category === "Outros")?.total, 300);
  assert.equal(safeContext.categories.find((item) => item.category === "Alimentação")?.total, 700);

  const serialized = JSON.stringify(safeContext);
  for (const sensitiveValue of [
    "Marina Confidencial",
    "marina@example.com",
    "Banco Real Black da Marina",
    "Visa",
    "Mastercard",
    "Terapia de João",
    "Ajuda para Maria",
    "Casa da Marina",
    "Viagem para Ana",
    "Categoria da Família Silva",
  ]) {
    assert.ok(!serialized.includes(sensitiveValue));
  }
});

test("categorias personalizadas são convertidas para Outros", () => {
  assert.equal(normalizeFinancialCategory("Alimentação & Delivery"), "Alimentação");
  assert.equal(normalizeFinancialCategory("Assinaturas & Lazer"), "Assinaturas");
  assert.equal(normalizeFinancialCategory("Meu gasto privado com João"), "Outros");
});

test("prompt contém somente aliases e não inclui nomes ou títulos originais", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Carolina Souza",
      email: "carolina.souza@example.com",
      role: "User",
      avatarInitials: "CS",
      monthlyIncomeBase: 7000,
      currency: "BRL",
      persona: "guardian",
      riskTolerance: "low",
      aiTone: "direct",
      maxCommitmentAlertPercent: 50,
      primaryFocus: "Reserva da Carolina",
    },
    cards: [{
      id: "private-card",
      name: "Banco Secreto Platinum",
      brand: "Elo",
      type: "credit",
      limit: 6000,
      spent: 1000,
      closingDay: 5,
      dueDay: 12,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    }],
    transactions: [],
    recurringItems: [{ id: "rec", title: "Pensão do Carlos", amount: 500, account: "Banco Secreto Platinum", category: "Moradia", dueDay: 5, active: true }],
    goals: [{ id: "goal", title: "Faculdade da Beatriz", category: "Educação", current: 3000, target: 10000 }],
    mainBalance: 4000,
    monthIncome: 7000,
    monthExpense: 2500,
  });

  const prompt = buildFinancialAnalystSystemPrompt(createSafeFinancialContext(telemetry));

  assert.ok(prompt.includes("Cartão 1"));
  assert.ok(prompt.includes("Meta 1"));
  for (const sensitiveValue of [
    "Carolina Souza",
    "carolina.souza@example.com",
    "Banco Secreto Platinum",
    "Elo",
    "Pensão do Carlos",
    "Faculdade da Beatriz",
    "Reserva da Carolina",
  ]) {
    assert.ok(!prompt.includes(sensitiveValue));
  }
});

test("redactKnownFinancialText remove rótulos conhecidos do chat", () => {
  const redacted = redactKnownFinancialText(
    "Carolina quer comprar Notebook do Carlos no Banco Secreto com cartão Visa para a Faculdade da Beatriz na Categoria Família Silva.",
    {
      userProfile: { name: "Carolina" },
      cards: [{ name: "Banco Secreto", brand: "Visa", type: "credit" }],
      recurringItems: [{ title: "Notebook do Carlos", account: "Banco Secreto" }],
      transactions: [{ category: "Categoria Família Silva" }],
      goals: [{ title: "Faculdade da Beatriz" }],
    }
  );

  assert.equal(
    redacted,
    "Usuário quer comprar Recorrência 1 no Cartão 1 com cartão [DADO REMOVIDO] para a Meta 1 na Outros."
  );
});

test("monthlyProjections são integradas à telemetria e geram seção 6 com integridade contábil", () => {
  const mockProjections = [
    {
      monthName: "Out",
      year: 2026,
      openingBalance: 1200,
      plannedIncomesTotal: 5000,
      recurringDebitTotal: 2000,
      recurringCreditTotal: 800,
      cardInstallments: 1200,
      totalCommitted: 4000,
      projectedFreeBalance: 2200,
    },
    {
      monthName: "Nov",
      year: 2026,
      openingBalance: 2200,
      plannedIncomesTotal: 5000,
      recurringDebitTotal: 2000,
      recurringCreditTotal: 800,
      cardInstallments: 5000,
      totalCommitted: 7800,
      projectedFreeBalance: -600,
    },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Arthur Teste",
      monthlyIncomeBase: 5000,
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "analytical",
      maxCommitmentAlertPercent: 60,
    },
    cards: [],
    transactions: [],
    recurringItems: [],
    goals: [],
    mainBalance: 1200,
    monthIncome: 5000,
    monthExpense: 3000,
    monthlyProjections: mockProjections,
  });

  assert.equal(telemetry.monthlyProjections?.length, 2);
  assert.equal(telemetry.monthlyProjections[0].projectedFreeBalance, 2200);
  assert.equal(telemetry.monthlyProjections[1].projectedFreeBalance, -600);

  const safeContext = createSafeFinancialContext(telemetry);
  assert.equal(safeContext.monthlyProjections.length, 2);
  assert.equal(safeContext.monthlyProjections[1].projectedFreeBalance, -600);

  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("6. PROJEÇÃO REAL MÊS A MÊS"));
  assert.ok(prompt.includes("Out/2026 (Mês Atual)"));
  assert.ok(prompt.includes("Nov/2026 (Mês +1)"));
  assert.ok(prompt.includes("⚠️ [DÉFICIT PREVISTO]"));
  assert.ok(prompt.includes("DIRETRIZES DE INTEGRIDADE CONTÁBIL MÊS A MÊS:"));
  assert.ok(prompt.includes("Não assuma lucros ou sobras que não constem estritamente na linha 'Saldo Livre Final Projetado'"));
  assert.ok(prompt.includes("Nunca afirme que o usuário está lucrando se os meses futuros apresentarem déficit"));
});

