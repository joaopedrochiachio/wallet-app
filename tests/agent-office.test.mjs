import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentOfficeAnalysis } from "../lib/services/agentOfficeService.ts";

const card = {
  id: "credit-1",
  name: "Nubank",
  brand: "mastercard",
  type: "credit",
  limit: 5000,
  spent: 1000,
  colorScheme: { gradient: "", border: "", accent: "#000", badgeText: "", chipGradient: "" },
};

function month(monthName, balance, invoice, surplus = 500) {
  return {
    monthName,
    year: 2026,
    projectedIncome: 5000,
    totalCommitted: 3500,
    projectedFreeBalance: balance,
    monthNetSurplus: surplus,
    totalInvoicesPending: invoice,
    cardInvoices: [{ cardId: "credit-1", cardName: "Nubank", pendingInvoice: invoice, totalInvoice: invoice, dueDay: 10 }],
  };
}

test("escritório projeta crédito e identifica o mês de maior fatura", () => {
  const analysis = buildAgentOfficeAnalysis({
    cards: [card],
    transactions: [],
    recurringItems: [],
    goals: [],
    targetEndMonthBalance: 700,
    referenceDate: new Date(2026, 9, 31, 12),
    monthlyProjections: [
      month("Outubro", 1800, 900),
      month("Novembro", 1700, 1400),
      month("Dezembro", 1600, 800),
    ],
  });

  assert.equal(analysis.credit.peakMonth, "Nov");
  assert.equal(analysis.credit.peakInvoice, 1400);
  assert.equal(analysis.credit.totalSixMonths, 3100);
});

test("escritório detecta padrões dos últimos 30 dias e compara período anterior", () => {
  const analysis = buildAgentOfficeAnalysis({
    cards: [card],
    recurringItems: [],
    goals: [],
    targetEndMonthBalance: 700,
    referenceDate: new Date(2026, 9, 31, 12),
    monthlyProjections: [month("Outubro", 1800, 900)],
    transactions: [
      { id: "a", amount: 300, type: "despesa", category: "Alimentação", account: "Nubank", occurredAt: new Date(2026, 9, 25) },
      { id: "b", amount: 100, type: "despesa", category: "Alimentação", account: "Nubank", occurredAt: new Date(2026, 8, 25) },
      { id: "c", amount: 90, type: "despesa", category: "Transporte", account: "Nubank", occurredAt: new Date(2026, 9, 20) },
    ],
  });

  assert.equal(analysis.patterns.topCategory, "Alimentação");
  assert.equal(analysis.patterns.categories[0].total, 300);
  assert.equal(analysis.patterns.categories[0].changePercent, 200);
});

test("escritório só projeta aportes usando margem acima da meta", () => {
  const analysis = buildAgentOfficeAnalysis({
    cards: [card],
    transactions: [],
    recurringItems: [],
    goals: [{ id: "goal", title: "Reserva", category: "Reserva", current: 1000, target: 5000 }],
    targetEndMonthBalance: 700,
    referenceDate: new Date(2026, 9, 31, 12),
    monthlyProjections: [
      month("Outubro", 1200, 900, 500),
      month("Novembro", 1000, 800, 300),
    ],
  });

  assert.equal(analysis.investments.suggestedMonthlyContribution, 400);
  assert.equal(analysis.investments.goalsProgress, 20);
  assert.ok(analysis.investments.projection36Months > 400 * 36);
});

test("escritório preserva o valor histórico da fatura mesmo quando ela já foi paga (pendingInvoice = 0)", () => {
  const paidMonth = {
    monthName: "Novembro",
    year: 2026,
    projectedIncome: 5000,
    totalCommitted: 3500,
    projectedFreeBalance: 1500,
    monthNetSurplus: 500,
    totalInvoicesPending: 0,
    cardInvoices: [
      {
        cardId: "credit-1",
        cardName: "Nubank",
        pendingInvoice: 0,
        totalInvoice: 950,
        dueDay: 10,
      },
    ],
  };

  const analysis = buildAgentOfficeAnalysis({
    cards: [card],
    transactions: [],
    recurringItems: [],
    goals: [],
    targetEndMonthBalance: 700,
    referenceDate: new Date(2026, 10, 15, 12),
    monthlyProjections: [paidMonth, month("Dezembro", 1600, 800)],
  });

  assert.equal(analysis.credit.series[0].amount, 950);
  assert.equal(analysis.credit.series[0].pendingAmount, 0);
  assert.equal(analysis.credit.series[0].isPaid, true);
  assert.equal(analysis.credit.peakMonth, "Dez");
  assert.equal(analysis.credit.peakInvoice, 800);
});
