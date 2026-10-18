import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDailySafeSpend,
  parseQuickExpenseText,
  simulatePurchaseDecision,
  getUpcomingFinancialEvents,
  calculateCheckInStreak,
  generateDailyCompanionAdvice,
  getBestCardToSpendToday,
  calculateWeeklySpendingVelocity,
} from "../lib/services/dailyCompanionService.ts";

test("calculateDailySafeSpend: calcula margem diária com exatidão considerando dias restantes", () => {
  // Teste em 15 de Outubro (mês com 31 dias, restam 31 - 15 + 1 = 17 dias)
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0); // Outubro = mês 9
  const res = calculateDailySafeSpend({
    projectedFreeBalance: 2000,
    targetEndMonthBalance: 700,
    currentDate: fixedDate,
  });

  assert.equal(res.remainingDaysInMonth, 17);
  assert.equal(res.safeMarginTotal, 1300);
  // 1300 / 17 = 76.47
  assert.equal(res.safeDailyAllowance, 76.47);
  assert.equal(res.status, "balanced");
});

test("calculateDailySafeSpend: trata saldo projetado menor que a meta estipulada", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0);
  const res = calculateDailySafeSpend({
    projectedFreeBalance: 500,
    targetEndMonthBalance: 700,
    currentDate: fixedDate,
  });

  assert.equal(res.safeDailyAllowance, 0);
  assert.equal(res.safeMarginTotal, -200);
  assert.equal(res.status, "overdrawn");
});

test("parseQuickExpenseText: reconhece valor, categoria e cartão de crédito específico", () => {
  const cards = [
    { id: "nubank-123", name: "Nubank" },
    { id: "xp-456", name: "XP Visa Infinite" },
  ];

  const res1 = parseQuickExpenseText("Almoço 38,50 no nubank", cards);
  assert.equal(res1.amount, 38.5);
  assert.equal(res1.title, "Almoço");
  assert.equal(res1.category, "Alimentação");
  assert.equal(res1.account, "Nubank");
  assert.equal(res1.cardId, "nubank-123");

  const res2 = parseQuickExpenseText("Uber 24.90", cards);
  assert.equal(res2.amount, 24.9);
  assert.equal(res2.title, "Uber");
  assert.equal(res2.category, "Transporte");
  assert.equal(res2.account, "Débito/Pix");
  assert.equal(res2.cardId, null);

  const res3 = parseQuickExpenseText("Farmácia R$ 75 no crédito", cards);
  assert.equal(res3.amount, 75);
  assert.equal(res3.title, "Farmácia");
  assert.equal(res3.category, "Saúde");
  assert.equal(res3.account, "Nubank"); // Primeiro cartão padrão se disse crédito
  assert.equal(res3.cardId, "nubank-123");
});

test("simulatePurchaseDecision: libera compra que preserva saldo confortável", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0);
  const verdict = simulatePurchaseDecision({
    amount: 150,
    installments: 1,
    isCredit: false,
    projectedFreeBalance: 2000,
    targetEndMonthBalance: 700,
    currentDate: fixedDate,
  });

  assert.equal(verdict.verdict, "approved");
  assert.ok(verdict.headline.includes("Liberado"));
  assert.ok(verdict.newSafeDailyAllowance > 0);
});

test("simulatePurchaseDecision: alerta quando a compra consome grande parte da margem diária", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0);
  const verdict = simulatePurchaseDecision({
    amount: 800, // margem total é 1000 (1700 - 700), 800 > 50%
    installments: 1,
    isCredit: false,
    projectedFreeBalance: 1700,
    targetEndMonthBalance: 700,
    currentDate: fixedDate,
  });

  assert.equal(verdict.verdict, "warning");
  assert.ok(verdict.headline.includes("Atenção"));
});

test("simulatePurchaseDecision: rejeita com perigo quando estoura a meta de fechamento", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0);
  const verdict = simulatePurchaseDecision({
    amount: 1500, // margem total é 500 (1200 - 700), 1500 estoura a meta
    installments: 1,
    isCredit: false,
    projectedFreeBalance: 1200,
    targetEndMonthBalance: 700,
    currentDate: fixedDate,
  });

  assert.equal(verdict.verdict, "danger");
  assert.ok(verdict.headline.includes("Risco Alto"));
});

test("getUpcomingFinancialEvents: filtra e ordena eventos na janela de 7 dias", () => {
  const fixedDate = new Date(2026, 9, 10, 12, 0, 0); // Dia 10
  const cards = [
    { id: "c1", name: "Nubank", dueDay: 12, closingDay: 5, spent: 450 }, // vence em 2 dias
    { id: "c2", name: "Inter", dueDay: 25, closingDay: 18, spent: 300 }, // vence em 15 dias (fora da janela de 7)
  ];
  const recurring = [
    { id: "r1", title: "Internet Fibra", amount: 120, dueDay: 11, type: "despesa", active: true }, // vence em 1 dia (urgente)
    { id: "r2", title: "Academia", amount: 99, dueDay: 20, type: "despesa", active: true }, // fora
  ];

  const events = getUpcomingFinancialEvents({ cards, recurringItems: recurring, currentDate: fixedDate });
  assert.equal(events.length, 2);
  assert.equal(events[0].title, "Internet Fibra");
  assert.equal(events[0].daysRemaining, 1);
  assert.equal(events[0].isUrgent, true);
  assert.equal(events[1].title, "Fatura Nubank");
  assert.equal(events[1].daysRemaining, 2);
});

test("calculateCheckInStreak: calcula sequência consecutiva corretamente", () => {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0];

  const records = [
    { date: today, mood: "in_control", timestamp: Date.now() },
    { date: yesterday, mood: "in_control", timestamp: Date.now() - 86400000 },
    { date: twoDaysAgo, mood: "tight_savings", timestamp: Date.now() - 86400000 * 2 },
  ];

  const { streak, todayCheckedIn } = calculateCheckInStreak(records);
  assert.equal(streak, 3);
  assert.equal(todayCheckedIn, true);
});

test("getBestCardToSpendToday: seleciona o cartão com melhor prazo até fechamento", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0); // Dia 15 de Outubro
  const cards = [
    { id: "c1", name: "Nubank", dueDay: 20, closingDay: 13, limit: 3000, spent: 500 }, // Fatura fechou dia 13 (2 dias atrás) -> melhor dia de compra!
    { id: "c2", name: "Inter", dueDay: 28, closingDay: 21, limit: 2000, spent: 200 }, // Fecha dia 21 (daqui a 6 dias)
  ];

  const best = getBestCardToSpendToday({ cards, currentDate: fixedDate });
  assert.ok(best !== null);
  assert.equal(best.cardName, "Nubank");
  assert.ok(best.reason.includes("Melhor dia"));
  assert.equal(best.availableLimit, 2500);
});

test("calculateWeeklySpendingVelocity: detecta ritmo acelerado ou controlado nos últimos 7 dias", () => {
  const fixedDate = new Date(2026, 9, 15, 12, 0, 0);
  const transactions = [
    // Últimos 7 dias (dia 8 a 15)
    { amount: 150, date: "2026-10-14", type: "despesa" },
    { amount: 200, date: "2026-10-12", type: "despesa" },
    // 7 dias anteriores (dia 1 a 7)
    { amount: 100, date: "2026-10-05", type: "despesa" },
  ];

  const velocity = calculateWeeklySpendingVelocity({ transactions, currentDate: fixedDate });
  assert.equal(velocity.last7DaysTotal, 350);
  assert.equal(velocity.previous7DaysTotal, 100);
  assert.equal(velocity.trend, "accelerated");
  assert.ok(velocity.differencePercent > 20);
});

