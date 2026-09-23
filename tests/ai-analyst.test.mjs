import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_CASCADE } from "../lib/services/geminiService.ts";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  normalizeFinancialCategory,
  simulatePurchaseImpact,
  buildFinancialAnalystSystemPrompt,
  inferHabitCategory,
  isExcludedFromHabitAnalysis,
} from "../lib/services/financialContextService.ts";
import {
  redactKnownFinancialText,
  redactPersonalData,
  isCommonCommercialTerm,
} from "../lib/services/privacyService.ts";
import {
  loadInitialDiagnosisSync,
  savePersistentDiagnosis,
} from "../lib/services/aiChatService.ts";

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

test("synthesizeFinancialTelemetry detecta e agrega gastos específicos como iFood e Uber", () => {
  const mockTransactions = [
    { id: "tx-1", title: "iFood", amount: 65.5, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-02" },
    { id: "tx-2", title: "iFood", amount: 48.0, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-05" },
    { id: "tx-3", title: "iFood", amount: 55.0, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-12" },
    { id: "tx-4", title: "Uber", amount: 28.5, type: "despesa", category: "Transporte", account: "Cartão 1", date: "2026-09-08" },
    { id: "tx-5", title: "Supermercado", amount: 400.0, type: "despesa", category: "Alimentação", account: "Conta corrente", date: "2026-09-10" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    cards: [],
    transactions: mockTransactions,
    recurringItems: [],
    goals: [],
    mainBalance: 2500,
    monthIncome: 6000,
    monthExpense: 597,
  });

  assert.ok(telemetry.topSpendItems);
  const ifoodItem = telemetry.topSpendItems.find((item) => item.title.toLowerCase() === "ifood");
  assert.ok(ifoodItem, "Deveria encontrar iFood nos maiores gastos");
  assert.equal(ifoodItem.count, 3);
  assert.equal(ifoodItem.total, 168.5);
  assert.equal(ifoodItem.category, "Alimentação");

  const uberItem = telemetry.topSpendItems.find((item) => item.title.toLowerCase() === "uber");
  assert.ok(uberItem, "Deveria encontrar Uber nos maiores gastos");
  assert.equal(uberItem.count, 1);
  assert.equal(uberItem.total, 28.5);
});

test("liquidityAnalysis calcula saldo livre hoje e saldo livre projetado mês que vem", () => {
  const mockProjections = [
    {
      monthName: "Out",
      year: 2026,
      openingBalance: 3000,
      plannedIncomesTotal: 7000,
      recurringDebitTotal: 2500,
      recurringCreditTotal: 500,
      cardInstallments: 1000,
      totalCommitted: 4000,
      projectedFreeBalance: 6000,
    },
    {
      monthName: "Nov",
      year: 2026,
      openingBalance: 6000,
      plannedIncomesTotal: 7000,
      recurringDebitTotal: 2500,
      recurringCreditTotal: 500,
      cardInstallments: 1200,
      totalCommitted: 4200,
      projectedFreeBalance: 8800,
    },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    cards: [],
    transactions: [],
    recurringItems: [],
    goals: [],
    mainBalance: 3000,
    monthIncome: 7000,
    monthExpense: 1500,
    monthlyProjections: mockProjections,
  });

  assert.ok(telemetry.liquidityAnalysis);
  assert.equal(telemetry.liquidityAnalysis.currentMonth.checkingBalance, 3000);
  assert.equal(telemetry.liquidityAnalysis.currentMonth.projectedFreeBalance, 6000);
  assert.equal(telemetry.liquidityAnalysis.nextMonth.projectedIncome, 7000);
  assert.equal(telemetry.liquidityAnalysis.nextMonth.committedExpenses, 4200);
  assert.equal(telemetry.liquidityAnalysis.nextMonth.projectedFreeBalance, 8800);
});

test("isCommonCommercialTerm e redactKnownFinancialText preservam termos comerciais como iFood", () => {
  assert.equal(isCommonCommercialTerm("ifood"), true);
  assert.equal(isCommonCommercialTerm("iFood"), true);
  assert.equal(isCommonCommercialTerm("Uber Viagem"), true);
  assert.equal(isCommonCommercialTerm("Supermercado Extra"), true);
  assert.equal(isCommonCommercialTerm("Consulta particular com Dr. José"), false);

  const redacted = redactKnownFinancialText(
    "Quanto eu gastei no iFood este mês comparado ao supermercado?",
    {
      transactions: [
        { title: "iFood", category: "Alimentação" },
        { title: "Supermercado Extra", category: "Alimentação" },
      ],
    }
  );

  assert.ok(redacted.toLowerCase().includes("ifood"), "Deveria preservar a palavra ifood na pergunta do usuário");
});

test("buildFinancialAnalystSystemPrompt inclui diretrizes de gastos específicos, liquidez e parcelas diluídas", () => {
  const telemetry = synthesizeFinancialTelemetry({
    cards: [],
    transactions: [
      { id: "tx-1", title: "iFood", amount: 350, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-10" },
    ],
    recurringItems: [],
    goals: [],
    mainBalance: 1500,
    monthIncome: 5000,
    monthExpense: 800,
    monthlyProjections: [
      {
        monthName: "Out",
        year: 2026,
        openingBalance: 1500,
        plannedIncomesTotal: 5000,
        recurringDebitTotal: 1000,
        recurringCreditTotal: 200,
        cardInstallments: 500,
        totalCommitted: 1700,
        projectedFreeBalance: 4800,
      },
      {
        monthName: "Nov",
        year: 2026,
        openingBalance: 4800,
        plannedIncomesTotal: 5000,
        recurringDebitTotal: 1000,
        recurringCreditTotal: 200,
        cardInstallments: 500,
        totalCommitted: 1700,
        projectedFreeBalance: 8100,
      },
    ],
  });

  const safeContext = createSafeFinancialContext(telemetry);
  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("7. LIQUIDEZ REAL: HOJE vs PRÓXIMO MÊS"));
  assert.ok(prompt.includes("8. GASTOS ESPECÍFICOS & ESTABELECIMENTOS MAIS FREQUENTES"));
  assert.ok(prompt.includes("iFood"));
  assert.ok(prompt.includes("R$ 350.00"));
  assert.ok(prompt.includes("GASTOS PARCELADOS AO LONGO DO TEMPO (MATURIDADE CONTÁBIL - NÃO ALARMISMO)"));
  assert.ok(prompt.includes("Ter um total parcelado futuro de R$ 2.000, R$ 3.000 ou mais distribuído nos próximos meses NÃO significa que o usuário está no vermelho"));
});

test("isCommonCommercialTerm reconhece McDonald's, Mc Donalds, Cantina e Burger King", () => {
  assert.equal(isCommonCommercialTerm("McDonald's"), true);
  assert.equal(isCommonCommercialTerm("mc donalds"), true);
  assert.equal(isCommonCommercialTerm("Cantina"), true);
  assert.equal(isCommonCommercialTerm("cantina faculdade"), true);
  assert.equal(isCommonCommercialTerm("Burger King"), true);
  assert.equal(isCommonCommercialTerm("bk"), true);
});

test("synthesizeFinancialTelemetry agrupa compras de McDonald's e Cantina e calcula contagem e total", () => {
  const mockTransactions = [
    { id: "tx-1", title: "McDonald's", amount: 45.0, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-02" },
    { id: "tx-2", title: "mc donalds", amount: 35.0, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-05" },
    { id: "tx-3", title: "Cantina", amount: 18.0, type: "despesa", category: "Alimentação", account: "Conta corrente", date: "2026-09-08" },
    { id: "tx-4", title: "cantina faculdade", amount: 15.0, type: "despesa", category: "Alimentação", account: "Conta corrente", date: "2026-09-09" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    cards: [],
    transactions: mockTransactions,
    recurringItems: [],
    goals: [],
    mainBalance: 2000,
    monthIncome: 5000,
    monthExpense: 113,
  });

  assert.ok(telemetry.topSpendItems);
  const mcItem = telemetry.topSpendItems.find((item) => item.title === "McDonald's");
  assert.ok(mcItem, "Deveria encontrar McDonald's agrupado");
  assert.equal(mcItem.count, 2);
  assert.equal(mcItem.total, 80.0);

  const cantinaItem = telemetry.topSpendItems.find((item) => item.title === "Cantina");
  assert.ok(cantinaItem, "Deveria encontrar Cantina agrupada");
  assert.equal(cantinaItem.count, 2);
  assert.equal(cantinaItem.total, 33.0);
});

test("buildFinancialAnalystSystemPrompt estabelece postura de CFO sem textinho e regra de caixa vs cartão no mês seguinte", () => {
  const telemetry = synthesizeFinancialTelemetry({
    cards: [
      {
        id: "card-1",
        name: "Nubank",
        brand: "Mastercard",
        type: "credit",
        limit: 2000,
        spent: 600,
        closingDay: 1,
        dueDay: 10,
        colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
      },
    ],
    transactions: [
      { id: "tx-1", title: "McDonald's", amount: 80, type: "despesa", category: "Alimentação", account: "Nubank", date: "2026-09-10" },
      { id: "tx-2", title: "Cantina", amount: 40, type: "despesa", category: "Alimentação", account: "Nubank", date: "2026-09-11" },
    ],
    recurringItems: [],
    goals: [],
    mainBalance: 3500,
    monthIncome: 6000,
    monthExpense: 120,
    monthlyProjections: [
      {
        monthName: "Out",
        year: 2026,
        openingBalance: 3500,
        plannedIncomesTotal: 6000,
        recurringDebitTotal: 1000,
        recurringCreditTotal: 100,
        cardInstallments: 500,
        totalCommitted: 1600,
        projectedFreeBalance: 7900,
      },
      {
        monthName: "Nov",
        year: 2026,
        openingBalance: 7900,
        plannedIncomesTotal: 6000,
        recurringDebitTotal: 1000,
        recurringCreditTotal: 100,
        cardInstallments: 500,
        totalCommitted: 1600,
        projectedFreeBalance: 12300,
      },
    ],
  });

  const safeContext = createSafeFinancialContext(telemetry);
  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("ANALISTA FINANCEIRO PESSOAL (Personal CFO)"));
  assert.ok(prompt.includes("SEM TEXTINHO E SEM BLÁ BLÁ BLÁ"));
  assert.ok(prompt.includes("CAIXA ATUAL vs CARTÃO NO MÊS SEGUINTE"));
  assert.ok(prompt.includes("Compras no cartão NÃO tiram dinheiro da conta corrente no mês em que são feitas"));
  assert.ok(prompt.includes("McDonald's"));
  assert.ok(prompt.includes("Cantina"));
});

test("synthesizeFinancialTelemetry agrupa dinamicamente qualquer estabelecimento sem marcas fixas e calcula baseline de gastos variáveis", () => {
  const mockTransactions = [
    { id: "tx-1", title: "Padaria Central", amount: 25.0, type: "despesa", category: "Outros", account: "Conta corrente", date: "2026-09-02" },
    { id: "tx-2", title: "padaria central paes", amount: 15.0, type: "despesa", category: "Outros", account: "Conta corrente", date: "2026-09-04" },
    { id: "tx-3", title: "Posto Shell Centro", amount: 180.0, type: "despesa", category: "Transporte", account: "Cartão 1", date: "2026-09-08" },
    { id: "tx-4", title: "posto shell combustivel", amount: 120.0, type: "despesa", category: "Transporte", account: "Cartão 1", date: "2026-09-15" },
    { id: "tx-5", title: "Posto Ipiranga", amount: 90.0, type: "despesa", category: "Transporte", account: "Cartão 1", date: "2026-09-18" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    cards: [],
    transactions: mockTransactions,
    recurringItems: [{ id: "rec-1", title: "Aluguel", amount: 1500, dueDay: 10, account: "Conta", category: "Moradia", active: true }],
    goals: [],
    mainBalance: 4000,
    monthIncome: 7000,
    monthExpense: 1930, // 1500 fixo + 430 variável
  });

  assert.ok(telemetry.topSpendItems);
  // Padaria Central deve agrupar as duas compras
  const padaria = telemetry.topSpendItems.find((i) => i.title.toLowerCase().includes("padaria central"));
  assert.ok(padaria, "Deveria agrupar Padaria Central");
  assert.equal(padaria.count, 2);
  assert.equal(padaria.total, 40.0);

  // Posto Shell deve agrupar as duas compras do Shell separadamente do Ipiranga
  const shell = telemetry.topSpendItems.find((i) => i.title.toLowerCase().includes("shell"));
  assert.ok(shell, "Deveria agrupar Posto Shell");
  assert.equal(shell.count, 2);
  assert.equal(shell.total, 300.0);

  const ipiranga = telemetry.topSpendItems.find((i) => i.title.toLowerCase().includes("ipiranga"));
  assert.ok(ipiranga, "Deveria manter Posto Ipiranga separado");
  assert.equal(ipiranga.count, 1);
  assert.equal(ipiranga.total, 90.0);

  // Baseline de gastos variáveis: 1930 - 1500 = 430
  assert.equal(telemetry.historicalVariableBaseline, 430);
});

test("createSafeFinancialContext preserva nomes reais de titulares e descrições sem substituir por Outros", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Lucas Pereira",
      monthlyIncomeBase: 8000,
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "analytical",
      primaryFocus: "Comprar Apartamento",
      maxCommitmentAlertPercent: 60,
    },
    cards: [],
    transactions: [
      { id: "tx-1", title: "Livraria Cultura", amount: 120, type: "despesa", category: "Outros", account: "Conta corrente", date: "2026-09-02" },
      { id: "tx-2", title: "Mecânico do Bairro", amount: 350, type: "despesa", category: "Outros", account: "Conta corrente", date: "2026-09-05" },
    ],
    recurringItems: [],
    goals: [],
    mainBalance: 5000,
    monthIncome: 8000,
    monthExpense: 470,
  });

  const safeContext = createSafeFinancialContext(telemetry);

  // Titulares reais NÃO devem ser 'Outros'
  assert.ok(safeContext.topSpendItems.some((i) => i.title === "Livraria Cultura"));
  assert.ok(safeContext.topSpendItems.some((i) => i.title === "Mecânico do Bairro"));
  assert.ok(safeContext.recentExpenses.some((i) => i.title === "Livraria Cultura"));
  assert.ok(safeContext.recentExpenses.some((i) => i.title === "Mecânico do Bairro"));
});

test("buildFinancialAnalystSystemPrompt inclui Reality Check de meses futuros e perfil completo do cliente", () => {
  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Marina Lima",
      monthlyIncomeBase: 9000,
      persona: "scaler",
      riskTolerance: "high",
      aiTone: "direct",
      primaryFocus: "Investir 30% da renda",
      maxCommitmentAlertPercent: 55,
    },
    cards: [],
    transactions: [
      { id: "tx-1", title: "Restaurante Paris", amount: 300, type: "despesa", category: "Alimentação", account: "Cartão 1", date: "2026-09-02" },
    ],
    recurringItems: [{ id: "rec-1", title: "Internet Fibra", amount: 150, dueDay: 5, account: "Conta", category: "Assinaturas", active: true }],
    goals: [],
    mainBalance: 4000,
    monthIncome: 9000,
    monthExpense: 450,
  });

  const safeContext = createSafeFinancialContext(telemetry);
  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("ANALISTA AUTODIDATA: IDENTIFICAÇÃO DE PADRÕES POR DESCRIÇÃO REAL DOS GASTOS"));
  assert.ok(prompt.includes("REALITY CHECK DE MESES FUTUROS (SEM ILUSÕES CONTÁBEIS E SEM EXTREMOS)"));
  assert.ok(prompt.includes("PERFIL INTEGRAL DO CLIENTE (ALINHAMENTO ESTRATÉGICO)"));
  assert.ok(prompt.includes("Baseline Estimado de Gastos Variáveis Habituais: R$ 300.00/mês"));
  assert.ok(prompt.includes("Investir 30% da renda"));
  assert.ok(prompt.includes("SCALER"));
});

test("inferHabitCategory padroniza hábitos e estabelecimentos para grupos de estilo de vida", () => {
  assert.equal(inferHabitCategory("Chiquinho Sorvetes", "Alimentação"), "Sobremesas & Doces");
  assert.equal(inferHabitCategory("Sorveteria Beijo Frio", "Outros"), "Sobremesas & Doces");
  assert.equal(inferHabitCategory("Açaí no Copo", "Alimentação"), "Sobremesas & Doces");
  assert.equal(inferHabitCategory("McDonald's Drive Thru", "Lanches"), "Lanches & Fast Food");
  assert.equal(inferHabitCategory("Burger King Shopping", "Alimentação"), "Lanches & Fast Food");
  assert.equal(inferHabitCategory("Subway", "Alimentação"), "Lanches & Fast Food");
  assert.equal(inferHabitCategory("Cantina Universitária", "Alimentação"), "Cafés, Padarias & Cantinas");
  assert.equal(inferHabitCategory("Padaria Rainha", "Café"), "Cafés, Padarias & Cantinas");
  assert.equal(inferHabitCategory("iFood Refeição", "Delivery"), "Restaurantes & Delivery");
  assert.equal(inferHabitCategory("Uber Corrida", "Transporte"), "Transporte & Mobilidade");
  assert.equal(inferHabitCategory("Droga Raia", "Saúde"), "Farmácia & Saúde");
  assert.equal(inferHabitCategory("Netflix Mensalidade", "Assinatura"), "Lazer & Assinaturas");
  assert.equal(inferHabitCategory("Papelaria Brasil", "Educação"), "Outros Hábitos");
});

test("synthesizeFinancialTelemetry calcula crédito vs débito em topSpendItems e lifestyleHabits", () => {
  const cards = [
    {
      id: "card-xp",
      name: "Cartão XP Visa",
      brand: "Visa",
      type: "credit",
      limit: 5000,
      spent: 800,
      closingDay: 5,
      dueDay: 15,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
  ];

  const transactions = [
    // Sobremesas: Chiquinho (1 no débito R$ 30, 1 no crédito R$ 50), Sorveteria (1 no crédito R$ 20)
    { id: "tx-1", title: "Chiquinho Sorvetes", amount: 30, type: "despesa", category: "Alimentação", account: "Conta Corrente", date: "2026-09-02" },
    { id: "tx-2", title: "Chiquinho Sorvetes", amount: 50, type: "despesa", category: "Alimentação", cardId: "card-xp", account: "Cartão XP Visa", date: "2026-09-05" },
    { id: "tx-3", title: "Sorveteria Tropical", amount: 20, type: "despesa", category: "Lazer", cardId: "card-xp", account: "Cartão XP Visa", date: "2026-09-10" },
    // Lanches: McDonald's (1 no crédito R$ 60, 1 no débito R$ 40)
    { id: "tx-4", title: "McDonald's", amount: 60, type: "despesa", category: "Alimentação", cardId: "card-xp", account: "Cartão XP Visa", date: "2026-09-12" },
    { id: "tx-5", title: "McDonald's", amount: 40, type: "despesa", category: "Alimentação", account: "Conta Corrente", date: "2026-09-14" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Lucas",
      monthlyIncomeBase: 6000,
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "direct",
      primaryFocus: "Reserva",
      maxCommitmentAlertPercent: 60,
    },
    cards,
    transactions,
    recurringItems: [],
    goals: [],
    mainBalance: 3000,
    monthIncome: 6000,
    monthExpense: 200,
  });

  // Validação em topSpendItems
  const chiquinho = telemetry.topSpendItems.find((i) => i.title === "Chiquinho Sorvetes");
  assert.ok(chiquinho, "Chiquinho deve estar nos topSpendItems");
  assert.equal(chiquinho.total, 80);
  assert.equal(chiquinho.count, 2);
  assert.equal(chiquinho.creditAmount, 50);
  assert.equal(chiquinho.debitAmount, 30);
  assert.equal(chiquinho.habitCategory, "Sobremesas & Doces");
  assert.ok(chiquinho.paymentBreakdown.includes("Crédito: R$ 50.00"));
  assert.ok(chiquinho.paymentBreakdown.includes("Débito: R$ 30.00"));

  const mcdonalds = telemetry.topSpendItems.find((i) => i.title === "McDonald's");
  assert.ok(mcdonalds, "McDonald's deve estar nos topSpendItems");
  assert.equal(mcdonalds.total, 100);
  assert.equal(mcdonalds.count, 2);
  assert.equal(mcdonalds.creditAmount, 60);
  assert.equal(mcdonalds.debitAmount, 40);
  assert.equal(mcdonalds.habitCategory, "Lanches & Fast Food");

  // Validação em lifestyleHabits
  assert.ok(telemetry.lifestyleHabits && telemetry.lifestyleHabits.length > 0);
  const sobremesas = telemetry.lifestyleHabits.find((h) => h.habitName === "Sobremesas & Doces");
  assert.ok(sobremesas, "Grupo Sobremesas & Doces deve existir");
  assert.equal(sobremesas.total, 100); // 80 Chiquinho + 20 Sorveteria
  assert.equal(sobremesas.count, 3);
  assert.equal(sobremesas.creditAmount, 70); // 50 + 20
  assert.equal(sobremesas.debitAmount, 30); // 30

  const lanches = telemetry.lifestyleHabits.find((h) => h.habitName === "Lanches & Fast Food");
  assert.ok(lanches, "Grupo Lanches & Fast Food deve existir");
  assert.equal(lanches.total, 100);
  assert.equal(lanches.count, 2);
  assert.equal(lanches.creditAmount, 60);
  assert.equal(lanches.debitAmount, 40);

  // Safe Financial Context e Prompt
  const safeContext = createSafeFinancialContext(telemetry);
  assert.ok(safeContext.lifestyleHabits && safeContext.lifestyleHabits.length >= 2);
  const prompt = buildFinancialAnalystSystemPrompt(safeContext);

  assert.ok(prompt.includes("GRUPOS MACRO DE ESTILO DE VIDA & HÁBITOS DE CONSUMO (CRÉDITO vs DÉBITO)"));
  assert.ok(prompt.includes("Sobremesas & Doces"));
  assert.ok(prompt.includes("Lanches & Fast Food"));
  assert.ok(prompt.includes("Crédito: R$ 70.00 | Débito: R$ 30.00"));
});

test("isExcludedFromHabitAnalysis detecta ajustes de conta, rifas e operações internas", () => {
  assert.equal(isExcludedFromHabitAnalysis("Ajuste na conta"), true);
  assert.equal(isExcludedFromHabitAnalysis("Ajuste de saldo"), true);
  assert.equal(isExcludedFromHabitAnalysis("Ajuste"), true);
  assert.equal(isExcludedFromHabitAnalysis("Rifa Mattheus"), true);
  assert.equal(isExcludedFromHabitAnalysis("Rifa beneficente"), true);
  assert.equal(isExcludedFromHabitAnalysis("Sorteio do PIX"), true);
  assert.equal(isExcludedFromHabitAnalysis("Correção de saldo"), true);
  assert.equal(isExcludedFromHabitAnalysis("Saldo inicial"), true);

  // Não devem ser excluídos
  assert.equal(isExcludedFromHabitAnalysis("Vivo Easy"), false);
  assert.equal(isExcludedFromHabitAnalysis("Pipoquinhha"), false);
  assert.equal(isExcludedFromHabitAnalysis("McDonald's"), false);
  assert.equal(isExcludedFromHabitAnalysis("Chiquinho Sorvetes"), false);
  assert.equal(isExcludedFromHabitAnalysis("Uber"), false);
});

test("inferHabitCategory não é enganado por categoria padrão e prioriza titular real", () => {
  // Mesmo que a categoria seja 'Alimentação & Delivery' (primeira do dropdown)
  assert.equal(inferHabitCategory("Vivo Easy", "Alimentação & Delivery"), "Telefonia & Internet");
  assert.equal(inferHabitCategory("Pipoquinhha", "Alimentação & Delivery"), "Lanches & Fast Food");
  assert.equal(inferHabitCategory("Ajuste na conta", "Alimentação & Delivery"), "");
  assert.equal(inferHabitCategory("Rifa Mattheus", "Alimentação & Delivery"), "");

  // Outros casos com titular expressivo
  assert.equal(inferHabitCategory("Claro Celular", "Outros"), "Telefonia & Internet");
  assert.equal(inferHabitCategory("Recarga Cel", "Outros"), "Telefonia & Internet");
  assert.equal(inferHabitCategory("Churrascaria Fogo de Chão", "Alimentação"), "Restaurantes & Delivery");
});

test("synthesizeFinancialTelemetry exclui Ajuste na conta e Rifa, e não classifica Vivo Easy como delivery", () => {
  const cards = [
    {
      id: "card-itau",
      name: "Itaú Click",
      brand: "Mastercard",
      type: "credit",
      limit: 3000,
      spent: 124.99,
      closingDay: 1,
      dueDay: 10,
      colorScheme: { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" },
    },
  ];

  // Exato cenário do screenshot do usuário: todas as despesas no crédito, categoria padrão 'Alimentação & Delivery'
  const transactions = [
    { id: "tx-1", title: "Vivo Easy", amount: 35.00, type: "despesa", category: "Alimentação & Delivery", cardId: "card-itau", date: "2026-09-02" },
    { id: "tx-2", title: "Rifa Mattheus", amount: 20.00, type: "despesa", category: "Alimentação & Delivery", cardId: "card-itau", date: "2026-09-05" },
    { id: "tx-3", title: "Pipoquinhha", amount: 20.00, type: "despesa", category: "Alimentação & Delivery", cardId: "card-itau", date: "2026-09-08" },
    { id: "tx-4", title: "Ajuste na conta", amount: 49.99, type: "despesa", category: "Alimentação & Delivery", cardId: "card-itau", date: "2026-09-12" },
  ];

  const telemetry = synthesizeFinancialTelemetry({
    userProfile: {
      name: "Usuário",
      monthlyIncomeBase: 5000,
      persona: "optimizer",
      riskTolerance: "moderate",
      aiTone: "direct",
      primaryFocus: "Economizar",
      maxCommitmentAlertPercent: 60,
    },
    cards,
    transactions,
    recurringItems: [],
    goals: [],
    mainBalance: 2000,
    monthIncome: 5000,
    monthExpense: 124.99,
  });

  // 1. "Ajuste na conta" e "Rifa Mattheus" NÃO devem constar em topSpendItems
  assert.ok(!telemetry.topSpendItems.some((i) => i.title.toLowerCase().includes("ajuste")));
  assert.ok(!telemetry.topSpendItems.some((i) => i.title.toLowerCase().includes("rifa")));

  // 2. "Vivo Easy" deve estar categorizado como Telefonia & Internet, NUNCA Delivery
  const vivoItem = telemetry.topSpendItems.find((i) => i.title === "Vivo Easy");
  assert.ok(vivoItem, "Vivo Easy deve constar nos topSpendItems elegíveis");
  assert.equal(vivoItem.habitCategory, "Telefonia & Internet");
  assert.notEqual(vivoItem.habitCategory, "Restaurantes & Delivery");

  // 3. "Pipoquinhha" deve estar como Lanches & Fast Food, NUNCA Delivery
  const pipocaItem = telemetry.topSpendItems.find((i) => i.title === "Pipoquinhha");
  assert.ok(pipocaItem, "Pipoquinhha deve constar nos topSpendItems");
  assert.equal(pipocaItem.habitCategory, "Lanches & Fast Food");
  assert.notEqual(pipocaItem.habitCategory, "Restaurantes & Delivery");

  // 4. Em lifestyleHabits, NÃO deve existir um grupo "Restaurantes & Delivery" agrupando Vivo Easy, Rifa e Ajuste
  const deliveryHabit = (telemetry.lifestyleHabits || []).find((h) => h.habitName === "Restaurantes & Delivery");
  assert.equal(deliveryHabit, undefined, "Não deve haver grupo de Restaurantes & Delivery");
});




