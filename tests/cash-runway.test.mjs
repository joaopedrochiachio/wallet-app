import assert from "node:assert/strict";
import test from "node:test";
import { buildCashRunway, collectRunwayEvents } from "../lib/services/cashRunway.ts";

const d = (y, m, day) => new Date(y, m, day);
const ev = (date, title, amount, kind = "bill") => ({ id: title, date, title, amount, kind, overdue: false, coveredByGoals: 0 });

test("antes do salário: saldo cobre as contas até lá", () => {
  const today = d(2026, 10, 25);
  const r = buildCashRunway({
    today, startBalance: 500,
    events: [ev(d(2026, 10, 28), "Internet", 100), ev(d(2026, 11, 7), "Salário", 3000, "income"), ev(d(2026, 11, 10), "Aluguel", 1500)],
  });
  assert.equal(r.segments.length, 2);
  const [untilSalary, afterSalary] = r.segments;
  assert.equal(untilSalary.billsTotal, 100);
  assert.equal(untilSalary.closingBalance, 400);
  assert.equal(untilSalary.shortfall, 0);
  assert.equal(afterSalary.openingBalance, 400);
  assert.equal(afterSalary.incomeTotal, 3000);
  assert.equal(afterSalary.closingBalance, 1900);
  assert.equal(r.firstUncovered, null);
});

test("dia 20 não fecha: aponta a conta que estoura e quanto falta", () => {
  const today = d(2026, 11, 1);
  const r = buildCashRunway({
    today, startBalance: 200,
    events: [
      ev(d(2026, 11, 7), "Salário", 1000, "income"),
      ev(d(2026, 11, 10), "Fatura Nubank", 700, "invoice"),
      ev(d(2026, 11, 20), "Faculdade", 450),
      ev(d(2026, 11, 22), "Freela", 300, "income"),
    ],
  });
  const salary = r.segments[1];
  assert.equal(salary.closingBalance, 50);
  assert.equal(salary.shortfall, 0);
  // Sem o freela antes do dia 20, a faculdade não cabe.
  const tight = buildCashRunway({ today, startBalance: 0, events: [ev(d(2026, 11, 7), "Salário", 1000, "income"), ev(d(2026, 11, 10), "Fatura", 700, "invoice"), ev(d(2026, 11, 20), "Faculdade", 450)] });
  assert.equal(tight.segments[1].firstUncovered.event.title, "Faculdade");
  assert.equal(tight.segments[1].shortfall, 150);
  assert.equal(tight.lowestBalance, -150);
});

test("no mesmo dia o salário entra antes das contas saírem", () => {
  const today = d(2026, 11, 1);
  const r = buildCashRunway({ today, startBalance: 0, events: [ev(d(2026, 11, 7), "Aluguel", 900), ev(d(2026, 11, 7), "Salário", 1000, "income")] });
  assert.equal(r.segments[1].shortfall, 0);
});

test("eventos reais: conta atrasada vira 'hoje', compra no cartão só pesa na fatura", () => {
  const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
  const cards = [
    { id: "conta", name: "Conta", type: "checking", brand: "", limit: 0, spent: 0, colorScheme },
    { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 1000, spent: 0, closingDay: 1, dueDay: 10, colorScheme },
  ];
  const recurringItems = [
    { id: "luz", title: "Luz", amount: 120, type: "expense", account: "Conta", cardId: "conta", category: "Casa", dueDay: 20, recurrenceType: "fixed_day", startYear: 2026, startMonth: 0, active: true },
    { id: "sal", title: "Salário", amount: 3000, type: "income", account: "Conta", cardId: "conta", category: "Renda", dueDay: 5, recurrenceType: "business_day_5", startYear: 2026, startMonth: 0, active: true, realizedPeriods: ["2026-11"] },
  ];
  const transactions = [
    { id: "c1", title: "Mercado", amount: 200, type: "despesa", account: "Nubank", cardId: "nu", category: "Mercado", occurredAt: new Date(2026, 10, 15, 12) },
  ];
  const today = d(2026, 10, 25);
  const events = collectRunwayEvents({ cards, recurringItems, transactions, today, monthsAhead: 1 });
  const luzNov = events.find((e) => e.title === "Luz" && e.overdue);
  assert.ok(luzNov, "luz de 20/nov não paga vira atrasada");
  assert.equal(luzNov.date.getTime(), today.getTime());
  const invoice = events.find((e) => e.kind === "invoice");
  assert.equal(invoice.amount, 200);
  assert.equal(invoice.date.getDate(), 10);
  assert.equal(invoice.date.getMonth(), 11);
  assert.ok(!events.some((e) => e.title === "Mercado"), "compra no cartão não sai da conta no dia");
  const salary = events.find((e) => e.kind === "income");
  assert.equal(salary.date.getMonth(), 11, "salário de novembro já recebido não volta");
});
