import assert from "node:assert/strict";
import test from "node:test";
import {
  getBillCoverageForPeriod,
  getGoalBillStatus,
  goalBillOperationId,
  listLinkableBills,
} from "../lib/utils/goalBills.ts";
import { getCardInvoiceDetailsForMonth } from "../lib/utils/ledger.ts";

/** Conta única de R$ 1.500 em janeiro/2027 paga no débito. */
const ipva = {
  id: "rec-ipva", title: "IPVA", amount: 1500, type: "expense", account: "Conta", cardId: "conta",
  category: "Transporte", dueDay: 15, recurrenceType: "fixed_day", installmentsCount: 1,
  startYear: 2027, startMonth: 0, active: true,
};
const goal = (overrides = {}) => ({
  id: "goal-ipva", title: "IPVA 2027", category: "Contas", current: 150, target: 1500,
  linkedBill: { recurringItemId: "rec-ipva", periodKey: "2027-01" }, ...overrides,
});

test("150 guardados numa conta de 1.500: faltam 1.350 no planejamento", () => {
  const coverage = getBillCoverageForPeriod([goal()], [ipva], "2027-01").get("rec-ipva");
  assert.equal(coverage.amount, 1500);
  assert.equal(coverage.covered, 150);
  assert.equal(coverage.remaining, 1350);
});

test("a meta só abate a conta do mês vinculado", () => {
  assert.equal(getBillCoverageForPeriod([goal()], [ipva], "2026-12").size, 0);
});

test("várias metas na mesma conta nunca abatem mais que o valor da conta", () => {
  const goals = [goal({ id: "a", current: 1000 }), goal({ id: "b", current: 900 })];
  const coverage = getBillCoverageForPeriod(goals, [ipva], "2027-01").get("rec-ipva");
  assert.equal(coverage.covered, 1500);
  assert.equal(coverage.remaining, 0);
  assert.deepEqual(coverage.goals.map((entry) => entry.covered), [1000, 500]);
});

test("conta já paga deixa de ser abatida e aparece como paga na meta", () => {
  const paid = { ...ipva, realizedPeriods: ["2027-01"] };
  assert.equal(getBillCoverageForPeriod([goal()], [paid], "2027-01").size, 0);
  assert.equal(getGoalBillStatus(goal(), [goal()], [paid]).state, "paid");
});

test("conta apagada do planejamento não quebra a meta", () => {
  const status = getGoalBillStatus(goal(), [goal()], []);
  assert.equal(status.state, "missing");
});

test("lista só contas futuras pendentes, a partir do mês atual", () => {
  const rent = { ...ipva, id: "rec-aluguel", title: "Aluguel", amount: 900, installmentsCount: 0, startYear: 2026, startMonth: 0, realizedPeriods: ["2026-11"] };
  const bills = listLinkableBills([ipva, rent], () => true, new Date(2026, 10, 25), 3);
  assert.deepEqual(bills.map((bill) => bill.item.id), ["rec-aluguel", "rec-ipva"]);
  assert.deepEqual(bills[0].occurrences.map((occ) => occ.periodKey), ["2026-12", "2027-01"]);
  assert.equal(bills[1].occurrences[0].periodLabel, "Janeiro 2027");
});

test("o id do uso da meta é estável e aceito pelas movimentações", () => {
  const id = goalBillOperationId("goal-ipva", goal().linkedBill, 15000);
  assert.equal(id, goalBillOperationId("goal-ipva", goal().linkedBill, 15000));
  assert.match(id, /^[a-zA-Z0-9_-]{1,120}$/);
});

test("limite volta ao pagar a fatura mesmo com 'spent' antigo gravado no cartão", () => {
  const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
  // spent: 400 é um valor velho salvo no Firestore; não pode congelar o limite.
  const card = { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 2000, spent: 400, closingDay: 3, dueDay: 10, colorScheme };
  const item = {
    id: "rec-tv", title: "TV", amount: 200, type: "expense", account: "Nubank", cardId: "nu",
    category: "Casa", dueDay: 20, recurrenceType: "fixed_day", installmentsCount: 2,
    startYear: 2026, startMonth: 10, realizedPeriods: ["2026-11"], active: true,
  };
  const purchase = {
    id: "tx-tv-1", title: "TV", amount: 200, type: "despesa", account: "Nubank", cardId: "nu",
    category: "Casa", recurringItemId: "rec-tv", periodKey: "2026-11", occurredAt: new Date(2026, 10, 20, 12),
  };
  const today = new Date(2026, 11, 8, 12);
  const pay = [
    { id: "p-out", amount: 200, type: "despesa", kind: "invoice_payment", account: "Conta", cardId: "conta", relatedCardId: "nu", groupId: "p", periodKey: "2026-12", occurredAt: today },
    { id: "p-in", amount: 200, type: "receita", kind: "invoice_settlement", account: "Nubank", cardId: "nu", relatedCardId: "conta", groupId: "p", periodKey: "2026-12", occurredAt: today },
  ];
  const before = getCardInvoiceDetailsForMonth(card, [purchase], [item], 2026, 11, today);
  const after = getCardInvoiceDetailsForMonth(card, [purchase, ...pay], [item], 2026, 11, today);
  assert.equal(before.availableLimit, 1600);
  assert.equal(after.availableLimit, 1800);
});
