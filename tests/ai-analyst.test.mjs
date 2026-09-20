import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_CASCADE } from "../lib/services/geminiService.ts";
import {
  synthesizeFinancialTelemetry,
  simulatePurchaseImpact,
  buildFinancialAnalystSystemPrompt,
} from "../lib/services/financialContextService.ts";

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

  const prompt = buildFinancialAnalystSystemPrompt(telemetry);

  assert.ok(prompt.includes("Arquetipo: GUARDIAN"));
  assert.ok(prompt.includes("Tom: Colaborativo"));
  assert.ok(prompt.includes("Camila"));
  assert.ok(prompt.includes("R$ 12000.00"));
});
