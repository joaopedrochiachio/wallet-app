import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCheckingBalance,
  calculateInvoiceSchedule,
  getInvoiceDueDate,
} from "../lib/utils/ledger.ts";
import { getPeriodKey, isRecurringActiveInMonth } from "../lib/utils/dateUtils.ts";

const colorScheme = {
  gradient: "",
  border: "",
  accent: "",
  badgeText: "",
  chipGradient: "",
};

const checking = {
  id: "checking",
  name: "Conta Principal",
  type: "checking",
  openingBalance: 0,
  brand: "",
  limit: 0,
  spent: 0,
  colorScheme,
};

const credit = {
  id: "credit",
  name: "Cartão Principal",
  type: "credit",
  brand: "",
  limit: 5000,
  spent: 0,
  closingDay: 10,
  dueDay: 18,
  colorScheme,
};

test("salário recebido menos contas PIX define o saldo real", () => {
  const result = calculateCheckingBalance(checking, [
    { amount: 5000, type: "receita", account: checking.name, cardId: checking.id },
    { amount: 1200, type: "despesa", account: checking.name, cardId: checking.id },
    { amount: 800, type: "despesa", account: "Débito/Pix", cardId: checking.id },
  ]);
  assert.equal(result, 3000);
});

test("compra depois do fechamento de setembro vence em outubro", () => {
  const dueDate = getInvoiceDueDate(credit, new Date(2026, 8, 13, 12));
  assert.equal(getPeriodKey(dueDate.getFullYear(), dueDate.getMonth()), "2026-10");
});

test("agenda da fatura aloca pagamento nas cobranças mais antigas", () => {
  const schedule = calculateInvoiceSchedule(credit, [
    { amount: 400, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 5, 12) },
    { amount: 900, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 13, 12) },
    { amount: 400, type: "receita", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 18, 12) },
  ]);
  assert.equal(schedule["2026-09"], 0);
  assert.equal(schedule["2026-10"], 900);
});

test("ocorrência realizada deixa de ser pendência no planejamento", () => {
  const salary = {
    active: true,
    startYear: 2026,
    startMonth: 8,
    realizedPeriods: ["2026-09"],
  };
  assert.equal(isRecurringActiveInMonth(salary, 2026, 8), false);
  assert.equal(isRecurringActiveInMonth(salary, 2026, 9), true);
});
