import assert from "node:assert/strict";
import test from "node:test";
import { buildRecurringRadar } from "../lib/services/recurringRadar.ts";

const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const cards = [
  { id: "conta", name: "Conta", type: "checking", brand: "", limit: 0, spent: 0, colorScheme },
  { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 800, spent: 0, closingDay: 1, dueDay: 10, colorScheme },
  { id: "itau", name: "Itaú", type: "credit", brand: "", limit: 500, spent: 0, closingDay: 8, dueDay: 15, colorScheme },
];
const base = { type: "expense", recurrenceType: "fixed_day", startYear: 2026, startMonth: 0, active: true, category: "Outros" };
const today = new Date(2026, 10, 25);

test("custo fixo, custo no ano e fatia da renda", () => {
  const r = buildRecurringRadar({
    cards, today,
    recurringItems: [
      { ...base, id: "spot", title: "Spotify", amount: 31.9, account: "Nubank", cardId: "nu", dueDay: 9 },
      { ...base, id: "luz", title: "Luz", amount: 120, account: "Conta", cardId: "conta", dueDay: 20 },
      { ...base, id: "sal", title: "Salário", amount: 3000, type: "income", account: "Conta", cardId: "conta", dueDay: 5, recurrenceType: "business_day_5" },
    ],
  });
  assert.equal(r.fixedMonthly, 151.9);
  assert.equal(r.nextYearTotal, 1822.8);
  assert.equal(r.monthlyIncome, 3000);
  assert.equal(Math.round(r.incomeShare * 1000) / 1000, 0.051);
});

test("alívio: mês em que o parcelamento acaba e quanto sobra a mais", () => {
  const r = buildRecurringRadar({
    cards, today,
    recurringItems: [
      { ...base, id: "anel", title: "Anel", amount: 91.66, account: "Nubank", cardId: "nu", dueDay: 5, installmentsCount: 3, startYear: 2026, startMonth: 10, overrides: { "2026-11": { amount: 91.68 } } },
    ],
  });
  const anel = r.costs[0];
  assert.equal(anel.kind, "installment");
  assert.equal(anel.remainingCount, 3);
  assert.equal(anel.lastPeriodKey, "2027-01");
  assert.deepEqual(r.relief.map((x) => [x.periodKey, x.amount]), [["2027-02", 91.66]]);
});

test("mesma assinatura ativa em dois cartões no mesmo mês vira alerta", () => {
  const r = buildRecurringRadar({
    cards, today,
    recurringItems: [
      { ...base, id: "cab-itau", title: "Cabelo", amount: 60, account: "Itaú", cardId: "itau", dueDay: 11 },
      { ...base, id: "cab-nu", title: "cabelo ", amount: 60, account: "Nubank", cardId: "nu", dueDay: 24, startYear: 2026, startMonth: 11 },
    ],
  });
  const dup = r.alerts.find((a) => a.kind === "duplicate");
  assert.ok(dup);
  assert.equal(dup.periods[0], "2026-12");
  assert.equal(dup.monthlyWaste, 60);
});

test("trocar de cartão sem sobrepor meses não é duplicidade", () => {
  const r = buildRecurringRadar({
    cards, today,
    recurringItems: [
      { ...base, id: "cab-itau", title: "Cabelo", amount: 60, account: "Itaú", cardId: "itau", dueDay: 11, endPeriodKey: "2026-12" },
      { ...base, id: "cab-nu", title: "Cabelo", amount: 60, account: "Nubank", cardId: "nu", dueDay: 24, startYear: 2026, startMonth: 11 },
    ],
  });
  assert.equal(r.alerts.filter((a) => a.kind === "duplicate").length, 0);
});

test("conta no débito antes do salário e mudança de valor programada", () => {
  const r = buildRecurringRadar({
    cards, today,
    recurringItems: [
      { ...base, id: "alug", title: "Aluguel", amount: 900, account: "Conta", cardId: "conta", dueDay: 3, overrides: { "2027-02": { amount: 950 } } },
      { ...base, id: "sal", title: "Salário", amount: 3000, type: "income", account: "Conta", cardId: "conta", dueDay: 5, recurrenceType: "business_day_5" },
    ],
  });
  const before = r.alerts.find((a) => a.kind === "before_income");
  assert.equal(before.dueDay, 3);
  assert.equal(before.incomeDay, 7, "5º dia útil de dezembro/2026");
  const change = r.alerts.find((a) => a.kind === "price_change");
  assert.deepEqual([change.periodKey, change.from, change.to], ["2027-02", 900, 950]);
});
