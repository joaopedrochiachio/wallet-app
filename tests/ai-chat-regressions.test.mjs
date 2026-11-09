import test from "node:test";
import assert from "node:assert/strict";
import {
  synthesizeFinancialTelemetry, createSafeFinancialContext, computeFortnightBreakdown,
  buildFinancialAnalystSystemPrompt, getProjectionPendingCommitted,
} from "../lib/services/financialContextService.ts";
import { generateDeterministicAuditDossier, generateDeterministicAnalystChatReply } from "../lib/services/agentManagerService.ts";

const checking = { id: "checking", name: "Conta principal", type: "checking", limit: 0, spent: 0 };
const credit = { id: "credit", name: "Cartão", type: "credit", limit: 5000, spent: 1000, closingDay: 10, dueDay: 18 };
const projection = {
  monthName: "Novembro", year: 2026, openingBalance: 950, actualClosingBalance: 500,
  plannedIncomesTotal: 0, recurringDebitTotal: 50, recurringCreditTotal: 0,
  cardInstallments: 300, totalCommitted: 500, pendingCommitted: 50, totalInvoicesPending: 0,
  projectedFreeBalance: 450,
};

function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 9, 12) });
  const recurringItems = [
    { id: "internet", title: "Internet", amount: 150, account: checking.name, cardId: checking.id, category: "Moradia", dueDay: 5, active: true },
    { id: "water", title: "Água", amount: 50, account: checking.name, cardId: checking.id, category: "Moradia", dueDay: 15, active: true },
  ];
  const transactions = [
    { id: "purchase", title: "Mercado", amount: 300, type: "despesa", account: credit.name, cardId: credit.id, category: "Alimentação", date: "2026-11-05", occurredAt: new Date(2026, 10, 5, 12) },
    { id: "internet-paid", title: "Pagamento internet fibra", amount: 150, type: "despesa", account: checking.name, cardId: checking.id, category: "Moradia", date: "2026-11-05", recurringItemId: "internet", periodKey: "2026-11" },
    { id: "payment", title: "Pagamento da fatura", amount: 300, type: "despesa", account: checking.name, cardId: checking.id, relatedCardId: credit.id, kind: "invoice_payment", category: "Dívidas", date: "2026-11-06", periodKey: "2026-11", groupId: "invoice-payment" },
    { id: "settlement", title: "Baixa da fatura", amount: 300, type: "receita", account: credit.name, cardId: credit.id, kind: "invoice_settlement", category: "Dívidas", date: "2026-11-06", periodKey: "2026-11", groupId: "invoice-payment" },
  ];
  return { cards: [checking, credit], transactions, recurringItems, goals: [], mainBalance: 500,
    monthIncome: 0, monthExpense: 450, monthlyProjections: [projection], targetEndMonthBalance: 100 };
}

test("contexto do chat preserva pendências separadas do histórico já pago", (t) => {
  const input = fixture(t);
  const context = createSafeFinancialContext(synthesizeFinancialTelemetry(input));
  assert.equal(context.monthlyProjections[0].totalCommitted, 500);
  assert.equal(context.monthlyProjections[0].pendingCommitted, 50);
  assert.equal(context.monthlyProjections[0].totalInvoicesPending, 0);
  assert.equal(context.liquidityAnalysis.currentMonth.pendingBills, 50);
  assert.equal(context.monthlyProjections[0].firstFortnight.projectedBalance, 450);
  assert.equal(context.commitments.recurringMonthlyTotal, 50);
  assert.equal(context.commitments.recurringCount, 1);
  assert.equal(context.credit.cardsSummary[0].invoiceAmount, 0);
  assert.equal(context.credit.cardsSummary[0].invoicePaidAmount, 300);
  assert.equal(context.credit.cardsSummary[0].invoiceIsPaid, true);
  assert.equal(context.credit.cardsSummary[0].spent, 1000);
  const prompt = buildFinancialAnalystSystemPrompt(context);
  assert.match(prompt, /Total ainda a pagar \(pendingCommitted\): R\$ 50\.00/);
  assert.match(prompt, /Faturas de Cartão ainda a pagar \(totalInvoicesPending\): R\$ 0\.00/);
  assert.match(prompt, /O contexto desta requisição substitui valores e status citados em mensagens antigas/);
});

test("pagamento de fatura e ajuste de saldo não duplicam consumo nem categorias", (t) => {
  const input = fixture(t);
  input.transactions.push({ ...input.transactions[1], id: "adjustment", kind: "balance_reconciliation", amount: 999, category: "Outros" });
  input.transactions.push({ ...input.transactions[0], id: "purchase-repeat" }, { ...input.transactions[1], id: "internet-repeat" });
  const telemetry = synthesizeFinancialTelemetry(input);
  assert.equal(telemetry.categories.reduce((sum, category) => sum + category.total, 0), 900);
  assert.equal(telemetry.topSpendItems.find((item) => item.title === "Mercado").creditAmount, 600);
  const internet = telemetry.topSpendItems.find((item) => /internet/i.test(item.title));
  assert.equal(internet.debitAmount, 300);
  assert.equal(internet.creditAmount, 0);
});

test("zero pendente é preservado e resposta local não chama limite futuro de fatura atual", (t) => {
  const input = fixture(t);
  input.monthlyProjections = [{ ...projection, pendingCommitted: 0, recurringDebitTotal: 0 }];
  const context = createSafeFinancialContext(synthesizeFinancialTelemetry(input));
  assert.equal(getProjectionPendingCommitted(context.monthlyProjections[0]), 0);
  const reply = generateDeterministicAnalystChatReply({ context, auditDossier: generateDeterministicAuditDossier({ context }), userMessage: "Como está minha fatura?" });
  assert.match(reply, /Fatura pendente.*R\$ 0\.00/);
  assert.match(reply, /quitada/);
  assert.doesNotMatch(reply, /Fatura atual de \*\*R\$ 1000/);
  const projectionReply = generateDeterministicAnalystChatReply({ context, auditDossier: generateDeterministicAuditDossier({ context }), userMessage: "Quero a projeção de caixa de 6 meses" });
  assert.match(projectionReply, /Ainda a pagar R\$ 0\.00/);
});

test("fatura vazia não é preenchida com parcelas de outros meses", (t) => {
  const input = fixture(t);
  const breakdown = computeFortnightBreakdown({ ...projection, monthName: "Dezembro", recurringDebitTotal: 0 }, [], input.cards, input.transactions);
  assert.equal(breakdown.firstFortnight.expenseTotal + breakdown.secondFortnight.expenseTotal, 0);
});

test("pagamento em outra conta ou com valor diferente não quita recorrência por semelhança de nome", (t) => {
  const input = fixture(t);
  input.transactions = [{ ...input.transactions[1], recurringItemId: null, title: "Internet", amount: 100 }];
  const telemetry = synthesizeFinancialTelemetry(input);
  assert.equal(telemetry.commitments.recurringMonthlyTotal, 200);
  input.transactions[0] = { ...input.transactions[0], amount: 150, account: "Outra conta", cardId: "other" };
  assert.equal(synthesizeFinancialTelemetry(input).commitments.recurringMonthlyTotal, 200);
});

test("gasto realizado sem projeção não vira conta pendente no fallback", (t) => {
  const input = fixture(t);
  const telemetry = synthesizeFinancialTelemetry({ ...input, cards: [checking], recurringItems: [], monthlyProjections: [], transactions: [] });
  assert.equal(telemetry.liquidityAnalysis.currentMonth.pendingBills, 0);
  assert.equal(telemetry.liquidityAnalysis.currentMonth.projectedFreeBalance, 500);
  assert.equal(telemetry.target.projectedEndMonthBalance, 500);
  const context = createSafeFinancialContext({ ...telemetry, liquidityAnalysis: undefined });
  assert.equal(context.liquidityAnalysis.currentMonth.pendingBills, 0);
  assert.equal(context.liquidityAnalysis.currentMonth.projectedFreeBalance, 500);
});
