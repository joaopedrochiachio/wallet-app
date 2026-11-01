import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinancialCalendar,
  summarizeFinancialCalendar,
} from "../lib/services/financialCalendarService.ts";

const checkingCard = {
  id: "checking-1",
  name: "Conta principal",
  brand: "wallet",
  type: "checking",
  limit: 0,
  spent: 0,
  colorScheme: {
    gradient: "",
    border: "",
    accent: "#000",
    badgeText: "",
    chipGradient: "",
  },
};

test("calendário usa occurredAt quando date contém rótulo amigável", () => {
  const calendar = buildFinancialCalendar({
    year: 2026,
    month: 9,
    cards: [checkingCard],
    recurringItems: [],
    now: new Date(2026, 9, 31, 12),
    transactions: [
      {
        id: "tx-1",
        title: "Mercado",
        amount: 84.9,
        type: "despesa",
        category: "Alimentação",
        account: "Conta principal",
        cardId: "checking-1",
        date: "07 de out., 09:30",
        occurredAt: new Date(2026, 9, 7, 9, 30),
      },
    ],
  });

  assert.equal(calendar.get(7).realizedExpense, 84.9);
  assert.equal(calendar.get(7).transactions[0].title, "Mercado");
  assert.equal(calendar.get(31).realizedExpense, 0);
});

test("calendário separa realizado de entradas e saídas previstas", () => {
  const recurringItems = [
    {
      id: "salary",
      title: "Salário",
      amount: 5000,
      type: "income",
      account: "Conta principal",
      cardId: "checking-1",
      category: "Renda",
      dueDay: 5,
      startYear: 2026,
      startMonth: 9,
      active: true,
    },
    {
      id: "rent",
      title: "Aluguel",
      amount: 1800,
      type: "expense",
      account: "Conta principal",
      cardId: "checking-1",
      category: "Moradia",
      dueDay: 10,
      startYear: 2026,
      startMonth: 9,
      active: true,
    },
  ];

  const calendar = buildFinancialCalendar({
    year: 2026,
    month: 9,
    cards: [checkingCard],
    recurringItems,
    transactions: [],
    now: new Date(2026, 9, 1, 12),
  });
  const totals = summarizeFinancialCalendar(calendar);

  assert.equal(calendar.get(5).plannedIncome, 5000);
  assert.equal(calendar.get(10).plannedExpense, 1800);
  assert.equal(totals.plannedNet, 3200);
  assert.equal(totals.realizedNet, 0);
});

test("recorrência realizada continua visível, sem duplicar a previsão", () => {
  const rent = {
    id: "rent",
    title: "Aluguel",
    amount: 1800,
    type: "expense",
    account: "Conta principal",
    cardId: "checking-1",
    category: "Moradia",
    dueDay: 10,
    startYear: 2026,
    startMonth: 9,
    active: true,
    realizedPeriods: ["2026-10"],
  };
  const calendar = buildFinancialCalendar({
    year: 2026,
    month: 9,
    cards: [checkingCard],
    recurringItems: [rent],
    transactions: [
      {
        id: "rent-tx",
        title: "Aluguel",
        amount: 1800,
        type: "despesa",
        category: "Moradia",
        account: "Conta principal",
        cardId: "checking-1",
        recurringItemId: "rent",
        periodKey: "2026-10",
        occurredAt: new Date(2026, 9, 10, 12),
      },
    ],
    now: new Date(2026, 9, 10, 12),
  });

  assert.equal(calendar.get(10).realizedExpense, 1800);
  assert.equal(calendar.get(10).plannedExpense, 0);
  assert.equal(calendar.get(10).bills[0].status, "paid");
});
