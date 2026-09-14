import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCheckingBalance,
  calculateInvoiceSchedule,
  calculateMonthlyAccountFlow,
  calculateProjectedBalance,
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

test("consolidado atual usa apenas o que entrou e saiu da conta", () => {
  const secondaryAccount = {
    ...checking,
    id: "secondary-checking",
    name: "Conta secundária",
  };
  const result = calculateMonthlyAccountFlow(
    [checking, secondaryAccount, credit],
    [
      { amount: 2800, type: "receita", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 8, 5) },
      { amount: 600, type: "despesa", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 8, 6) },
      { amount: 1005, type: "despesa", account: credit.name, cardId: credit.id, occurredAt: new Date(2026, 8, 7) },
      { amount: 999, type: "receita", account: secondaryAccount.name, cardId: secondaryAccount.id, occurredAt: new Date(2026, 8, 8) },
      { amount: 900, type: "receita", account: checking.name, cardId: checking.id, occurredAt: new Date(2026, 9, 5) },
    ],
    new Date(2026, 8, 13),
  );

  assert.deepEqual(result, { income: 2800, outflow: 600 });
});

test("previsão antiga não altera o saldo nem o consolidado realizado", () => {
  const plannedEntry = {
    id: "planned-rent-2026-09",
    amount: 1200,
    type: "despesa",
    account: checking.name,
    cardId: checking.id,
    occurredAt: new Date(2026, 8, 10),
  };

  assert.equal(calculateCheckingBalance(checking, [plannedEntry]), 0);
  assert.deepEqual(
    calculateMonthlyAccountFlow([checking], [plannedEntry], new Date(2026, 8, 13)),
    { income: 0, outflow: 0 },
  );
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

test("compra fixa parcelada termina depois da quantidade de meses definida", () => {
  const purchase = {
    active: true,
    startYear: 2026,
    startMonth: 8,
    installmentsCount: 3,
  };

  assert.equal(isRecurringActiveInMonth(purchase, 2026, 8), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 9), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 10), true);
  assert.equal(isRecurringActiveInMonth(purchase, 2026, 11), false);
});

test("pagamento futuro único existe somente no mês planejado", () => {
  const oneTimePayment = {
    active: true,
    startYear: 2026,
    startMonth: 10,
    installmentsCount: 1,
  };

  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 9), false);
  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 10), true);
  assert.equal(isRecurringActiveInMonth(oneTimePayment, 2026, 11), false);
});

test("saldo do mês anterior é transportado como saldo inicial do próximo mês", () => {
  // Mês 0 (Setembro): saldo em conta = 2.500, entradas pendentes = 500, compromissos = 1.000
  const month0Opening = 2500;
  const month0Projected = calculateProjectedBalance(month0Opening, 500, 1000);
  assert.equal(month0Projected, 2000);

  // Mês 1 (Outubro): saldo inicial vem do projetado do mês 0 (2.000), salário = 6.000, compromissos = 3.500
  const month1Opening = month0Projected;
  assert.equal(month1Opening, 2000);
  const month1Projected = calculateProjectedBalance(month1Opening, 6000, 3500);
  assert.equal(month1Projected, 4500);

  // Mês 2 (Novembro): saldo inicial vem do mês 1 (4.500), salário = 6.000, compromissos = 4.000
  const month2Opening = month1Projected;
  assert.equal(month2Opening, 4500);
  const month2Projected = calculateProjectedBalance(month2Opening, 6000, 4000);
  assert.equal(month2Projected, 6500);
});

