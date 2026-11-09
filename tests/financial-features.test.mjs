import test from "node:test";
import assert from "node:assert/strict";
import { getAutomaticDueOccurrences, getPendingDueOccurrences, getRecurringPaymentStatus } from "../lib/utils/timeProgression.ts";
import { buildForwardRecurringUpdate } from "../lib/utils/dateUtils.ts";
import { calculateCheckingBalance } from "../lib/utils/ledger.ts";
import { getCategoryBudgetProgress, validateCategoryBudgets } from "../lib/utils/categoryBudgets.ts";
import { commitGoalOperation } from "../lib/utils/goalOperations.ts";
import { hasRecordedRecurringOccurrence } from "../lib/utils/recurringOccurrences.ts";
import { synthesizeFinancialTelemetry } from "../lib/services/financialContextService.ts";

const account = { id: "checking", name: "Conta", type: "checking", openingBalance: 1000, limit: 0, spent: 0 };
const card = { id: "credit", name: "Cartão", type: "credit", limit: 5000, spent: 0 };
const now = new Date(2026, 10, 9, 12);
const bill = { id: "bill", title: "Aluguel", amount: 500, account: account.name, cardId: account.id, category: "Moradia", type: "expense", dueDay: 5, startYear: 2026, startMonth: 10, active: true };

test("orçamento inclui categorias antigas da captura rápida junto às categorias do formulário", () => {
  const budget = { id: "food", category: "Alimentação & Delivery", amount: 500, alertPercent: 80 };
  const entries = [{ amount: 35, type: "despesa", category: "Alimentação", occurredAt: now.toISOString() }, { amount: 25, type: "despesa", category: budget.category, occurredAt: now.toISOString() }];
  assert.equal(getCategoryBudgetProgress([budget], entries, 2026, 10)[0].spent, 60);
  assert.throws(() => validateCategoryBudgets([budget, { ...budget, id: "legacy", category: "Alimentação" }]));
});

test("chegar ao vencimento mantém conta e salário pendentes sem alterar o saldo", () => {
  const items = [bill, { ...bill, id: "salary", type: "income", amount: 3000 }];
  assert.equal(getPendingDueOccurrences(items, [account], [], now).length, 2);
  assert.deepEqual(getAutomaticDueOccurrences(items, [account], [], now), []);
  assert.equal(calculateCheckingBalance(account, []), 1000);
  assert.equal(getRecurringPaymentStatus(bill, 2026, 10, now), "overdue");
  assert.equal(getRecurringPaymentStatus({ ...bill, dueDay: 9 }, 2026, 10, now), "due");
  assert.equal(getRecurringPaymentStatus({ ...bill, dueDay: 15 }, 2026, 10, now), "scheduled");
  assert.equal(getRecurringPaymentStatus({ ...bill, realizedPeriods: ["2026-11"] }, 2026, 10, now), "paid");
});

test("automação depende da autorização para dinheiro em conta e mantém cobranças no cartão", () => {
  const items = [bill, { ...bill, id: "automatic", autoConfirm: true }, { ...bill, id: "salary", type: "income", autoConfirm: true }, { ...bill, id: "subscription", account: card.name, cardId: card.id }];
  assert.deepEqual(getAutomaticDueOccurrences(items, [account, card], [], now).map((item) => item.recurringItemId).sort(), ["automatic", "salary", "subscription"]);
});

test("desfazer uma confirmação não permite recriação automática da mesma competência", () => {
  const item = { ...bill, autoConfirm: true, manualConfirmationPeriods: ["2026-11"] };
  assert.equal(getPendingDueOccurrences([item], [account], [], now).length, 1);
  assert.equal(getAutomaticDueOccurrences([item], [account], [], now).length, 0);
  assert.equal(getAutomaticDueOccurrences([{ ...item, account: card.name, cardId: card.id }], [card], [], now).length, 0);
  assert.equal(getAutomaticDueOccurrences([item], [account], [], new Date(2026, 11, 9, 12)).length, 1);
});

test("ativar automação a partir do mês atual preserva meses antigos pendentes", () => {
  const original = { ...bill, startMonth: 8 };
  const updated = { ...original, ...buildForwardRecurringUpdate(original, "2026-11", { autoConfirm: true }) };
  assert.deepEqual(getAutomaticDueOccurrences([updated], [account], [], now).map((item) => item.periodKey), ["2026-11"]);
});

test("quitar uma conta atrasada não marca a parcela do mês atual como paga", () => {
  const paidOctober = { id: "late", amount: 500, type: "despesa", account: account.name, cardId: account.id, recurringItemId: bill.id, periodKey: "2026-10", occurredAt: now, title: bill.title };
  assert.equal(hasRecordedRecurringOccurrence(bill, "2026-10", [paidOctober], [account]), true);
  assert.equal(hasRecordedRecurringOccurrence(bill, "2026-11", [paidOctober], [account]), false);
  const prepaidNovember = { ...paidOctober, periodKey: "2026-11", occurredAt: new Date(2026, 9, 28) };
  assert.equal(hasRecordedRecurringOccurrence(bill, "2026-11", [prepaidNovember], [account]), true);
});

test("pendências de meses anteriores continuam protegidas na projeção e no cronograma da IA", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now });
  const telemetry = synthesizeFinancialTelemetry({ cards: [account], transactions: [], recurringItems: [{ ...bill, startMonth: 9 }], goals: [], mainBalance: 1000, monthIncome: 0, monthExpense: 0,
    monthlyProjections: [{ monthName: "Novembro", year: 2026, openingBalance: 1000, actualClosingBalance: 1000, plannedIncomesTotal: 0, recurringDebitTotal: 1000, recurringCreditTotal: 0, cardInstallments: 0, totalCommitted: 1000, pendingCommitted: 1000, totalInvoicesPending: 0, projectedFreeBalance: 0 }],
  });
  assert.equal(telemetry.liquidityAnalysis.currentMonth.pendingBills, 1000);
  assert.equal(telemetry.monthlyProjections[0].firstFortnight.expenseTotal, 1000);
  assert.equal(telemetry.monthlyProjections[0].firstFortnight.projectedBalance, 0);
});

const budget = { id: "food", category: "Alimentação", amount: 500, alertPercent: 80 };
const expense = { id: "buy", amount: 420, type: "despesa", account: card.name, cardId: card.id, category: "Alimentação", occurredAt: new Date(2026, 10, 5, 12) };

test("orçamento calcula 84% consumidos e R$ 80 restantes com alerta", () => {
  const [result] = getCategoryBudgetProgress([budget], [expense], 2026, 10);
  assert.equal(result.spent, 420); assert.equal(result.remaining, 80); assert.equal(result.percent, 84); assert.equal(result.status, "warning");
});

test("pagar fatura, ajustar saldo e transferir para metas não duplica o consumo", () => {
  const transactions = [expense,
    { ...expense, id: "invoice", kind: "invoice_payment" },
    { ...expense, id: "settlement", kind: "invoice_settlement", type: "receita" },
    { ...expense, id: "adjust", kind: "balance_reconciliation" },
    { ...expense, id: "goal", groupId: "goal-operation" },
    { ...expense, id: "planned-future" },
  ];
  assert.equal(getCategoryBudgetProgress([budget], transactions, 2026, 10)[0].spent, 420);
});

test("estornos reduzem o gasto; o orçamento separa meses, anos e excedentes", () => {
  const transactions = [expense, { ...expense, id: "refund", type: "receita", amount: 100 }, { ...expense, id: "past", occurredAt: new Date(2025, 10, 5) }];
  assert.equal(getCategoryBudgetProgress([budget], transactions, 2026, 10)[0].spent, 320);
  assert.equal(getCategoryBudgetProgress([budget], transactions, 2026, 11)[0].spent, 0);
  assert.equal(getCategoryBudgetProgress([budget], transactions, 2025, 10)[0].spent, 420);
  const [over] = getCategoryBudgetProgress([budget], [{ ...expense, amount: 550 }], 2026, 10);
  assert.equal(over.status, "exceeded"); assert.equal(over.remaining, -50); assert.equal(over.percent, 110);
});

test("configuração de orçamento rejeita categoria duplicada e limites inválidos", () => {
  assert.deepEqual(validateCategoryBudgets([budget]), [budget]);
  assert.throws(() => validateCategoryBudgets([budget, { ...budget, id: "other", category: " alimentação " }]));
  for (const amount of [0, -1, NaN, Infinity]) assert.throws(() => validateCategoryBudgets([{ ...budget, amount }]));
  for (const alertPercent of [0, 101, 80.5]) assert.throws(() => validateCategoryBudgets([{ ...budget, alertPercent }]));
});

class MemoryAtomicStore {
  data = new Map([["cards/checking", account], ["cards/credit", card]]);
  failBeforeCommit = false;
  failAfterCommit = false;
  queue = Promise.resolve();
  run(work) {
    const task = this.queue.then(async () => {
      const pending = new Map();
      const result = await work({ get: async (path) => structuredClone(this.data.get(path)), set: (path, value) => pending.set(path, structuredClone(value)) });
      if (this.failBeforeCommit) { this.failBeforeCommit = false; throw new Error("Falha antes de salvar"); }
      for (const [path, value] of pending) this.data.set(path, value);
      if (this.failAfterCommit) { this.failAfterCommit = false; throw new Error("Resposta perdida"); }
      return result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  entries() { return [...this.data.entries()].filter(([path]) => path.startsWith("transactions/")).map(([id, entry]) => ({ ...entry, id, title: entry.description, account: entry.paymentMethod, type: entry.type === "out" ? "despesa" : "receita" })); }
}
const goal = { id: "savings", title: "Reserva", category: "Segurança", target: 5000, current: 0 };
const operation = (details = {}) => ({ operationId: "create", goalId: goal.id, action: "create", initialGoal: goal, amount: 0, occurredAt: now.toISOString(), ...details });

test("criar meta com aporte inicial salva meta, débito e recibo juntos", async () => {
  const store = new MemoryAtomicStore();
  const result = await commitGoalOperation(store, operation({ amount: 100, accountId: account.id }));
  assert.equal(result.current, 100); assert.equal(store.entries().length, 1); assert.equal(calculateCheckingBalance(account, store.entries()), 900);
  assert.ok(store.data.has("goals/savings/movements/create"));
});

test("falha ao criar meta não deixa saldo parcial e a tentativa seguinte não duplica", async () => {
  const store = new MemoryAtomicStore(); store.failBeforeCommit = true;
  const input = operation({ amount: 100, accountId: account.id });
  await assert.rejects(commitGoalOperation(store, input));
  assert.equal(store.data.has("goals/savings"), false); assert.equal(store.entries().length, 0);
  await commitGoalOperation(store, input); await commitGoalOperation(store, input);
  assert.equal(store.data.get("goals/savings").current, 100); assert.equal(store.entries().length, 1);
});

test("resposta perdida após confirmar aporte pode ser repetida com o mesmo identificador", async () => {
  const store = new MemoryAtomicStore(); await commitGoalOperation(store, operation());
  const input = operation({ action: "contribute", operationId: "deposit", amount: 33.33, accountId: account.id });
  store.failAfterCommit = true; await assert.rejects(commitGoalOperation(store, input));
  await commitGoalOperation(store, input);
  assert.equal(store.data.get("goals/savings").current, 33.33); assert.equal(store.entries().length, 1);
  assert.equal(calculateCheckingBalance(account, store.entries()), 966.67);
});

test("aportes concorrentes usam o saldo atual; resgate mantém conta e meta coerentes", async () => {
  const store = new MemoryAtomicStore(); await commitGoalOperation(store, operation());
  await Promise.all(Array.from({ length: 10 }, (_, index) => commitGoalOperation(store, operation({ action: "contribute", operationId: `add-${index}`, amount: 10, accountId: account.id }))));
  assert.equal(store.data.get("goals/savings").current, 100);
  await commitGoalOperation(store, operation({ action: "withdraw", operationId: "withdraw", amount: 23.33, accountId: account.id }));
  assert.equal(store.data.get("goals/savings").current, 76.67);
  assert.equal(calculateCheckingBalance(account, store.entries()), 923.33);
});

test("resgate acima do saldo atual e conta de crédito são rejeitados sem gravar nada", async () => {
  const store = new MemoryAtomicStore(); await commitGoalOperation(store, operation());
  await assert.rejects(commitGoalOperation(store, operation({ action: "withdraw", operationId: "invalid", amount: 10, accountId: account.id })), /saldo da meta mudou/);
  await assert.rejects(commitGoalOperation(store, operation({ action: "contribute", operationId: "credit", amount: 10, accountId: card.id })), /conta corrente/);
  assert.equal(store.entries().length, 0); assert.equal(store.data.get("goals/savings").current, 0);
});

test("valores já guardados são registrados sem movimentar conta e não aceitam reuso com outro valor", async () => {
  const store = new MemoryAtomicStore(); await commitGoalOperation(store, operation({ amount: 100 }));
  const input = operation({ action: "contribute", operationId: "external", amount: 50 });
  await commitGoalOperation(store, input);
  assert.equal(store.entries().length, 0); assert.equal(store.data.get("goals/savings").current, 150);
  await assert.rejects(commitGoalOperation(store, { ...input, amount: 60 }), /outra movimentação/);
});
