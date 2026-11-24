import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCardStatement,
  getInvoiceCycle,
  invoiceReference,
} from "../lib/utils/creditCardEngine.ts";
import { buildForwardRecurringUpdate, isRecurringActiveInMonth } from "../lib/utils/dateUtils.ts";
import { getPendingDueOccurrences } from "../lib/utils/timeProgression.ts";

const colorScheme = { gradient: "", border: "", accent: "", badgeText: "", chipGradient: "" };
const nubank = { id: "nu", name: "Nubank", type: "credit", brand: "", limit: 2000, spent: 0, closingDay: 3, dueDay: 10, colorScheme };
const inter = { id: "inter", name: "Inter", type: "credit", brand: "", limit: 3000, spent: 0, closingDay: 20, dueDay: 28, colorScheme };
const checking = { id: "conta", name: "Conta", type: "checking", brand: "", limit: 0, spent: 0, openingBalance: 5000, colorScheme };

/** Compra de R$ 400 em 2x feita em 20/nov no Nubank (fecha 3, vence 10). */
function purchase400in2x() {
  const item = {
    id: "rec-tv", title: "TV", amount: 200, type: "expense", account: "Nubank", cardId: "nu",
    category: "Casa", dueDay: 20, recurrenceType: "fixed_day", installmentsCount: 2,
    startYear: 2026, startMonth: 10, realizedPeriods: ["2026-11"], active: true,
  };
  const first = {
    id: "tx-tv-1", title: "TV", amount: 200, type: "despesa", account: "Nubank", cardId: "nu",
    category: "Casa", recurringItemId: "rec-tv", periodKey: "2026-11", occurredAt: new Date(2026, 10, 20, 12),
  };
  return { item, entries: [first] };
}

function payment(amount, periodKey, date, id = `pay-${periodKey}-${amount}`) {
  return [
    { id: `${id}-out`, amount, type: "despesa", kind: "invoice_payment", account: "Conta", cardId: "conta", relatedCardId: "nu", groupId: id, periodKey, occurredAt: date },
    { id: `${id}-in`, amount, type: "receita", kind: "invoice_settlement", account: "Nubank", cardId: "nu", relatedCardId: "conta", groupId: id, periodKey, occurredAt: date },
  ];
}

test("400 em 2x: consome 400 do limite e só 200 vão para a fatura", () => {
  const { item, entries } = purchase400in2x();
  const today = new Date(2026, 10, 24, 12);
  const s = buildCardStatement(nubank, entries, [item], { today });
  assert.equal(s.usedLimit, 400);
  assert.equal(s.availableLimit, 1600);
  assert.equal(s.getInvoice("2026-12").total, 200); // compra de 20/nov → fatura de dezembro
  assert.equal(s.getInvoice("2027-01").total, 200); // 2ª parcela (20/dez) → fatura de janeiro
  assert.equal(s.amountDue, 200);
});

test("pagar 200 da fatura libera 200 de limite na hora, sem esperar quitar tudo", () => {
  const { item, entries } = purchase400in2x();
  const today = new Date(2026, 11, 8, 12);
  const after = buildCardStatement(nubank, [...entries, ...payment(200, "2026-12", today)], [item], { today });
  assert.equal(after.usedLimit, 200);
  assert.equal(after.getInvoice("2026-12").status, "paid");
  assert.equal(after.getInvoice("2026-12").total, 200, "a fatura paga mantém o valor histórico");
});

test("pagamento parcial libera exatamente o valor pago", () => {
  const { item, entries } = purchase400in2x();
  const today = new Date(2026, 11, 8, 12);
  const s = buildCardStatement(nubank, [...entries, ...payment(50, "2026-12", today)], [item], { today });
  assert.equal(s.usedLimit, 350);
  assert.equal(s.getInvoice("2026-12").outstanding, 150);
  assert.equal(s.getInvoice("2026-12").paid, 50);
});

test("pagar mais que a fatura antecipa a próxima parcela e libera o limite", () => {
  const { item, entries } = purchase400in2x();
  const today = new Date(2026, 11, 8, 12);
  const s = buildCardStatement(nubank, [...entries, ...payment(400, "2026-12", today)], [item], { today });
  assert.equal(s.usedLimit, 0);
  assert.equal(s.getInvoice("2027-01").outstanding, 0);
  assert.equal(s.getInvoice("2027-01").creditApplied, 200);
});

test("fatura de janeiro é explicada como gastos de dezembro", () => {
  const cycle = getInvoiceCycle(nubank, "2027-01");
  assert.equal(cycle.referenceMonth, 11);
  assert.equal(cycle.closingDate.getDate(), 3);
  assert.equal(cycle.cycleStart.getMonth(), 11);
  assert.equal(cycle.cycleStart.getDate(), 4);
  assert.equal(invoiceReference(cycle), "gastos de dezembro · 04/dez a 03/jan");
  // Cartão que fecha no fim do mês e vence no começo do seguinte.
  const lateClose = { ...nubank, closingDay: 28, dueDay: 5 };
  assert.equal(getInvoiceCycle(lateClose, "2027-01").referenceMonth, 11);
});

test("mover assinatura para outro cartão muda só as faturas seguintes", () => {
  const spotify = {
    id: "rec-spotify", title: "Spotify", amount: 21.9, type: "expense", account: "Nubank", cardId: "nu",
    category: "Assinaturas", dueDay: 15, recurrenceType: "fixed_day", startYear: 2026, startMonth: 8,
    realizedPeriods: ["2026-09", "2026-10", "2026-11"], active: true,
  };
  const posted = ["2026-09", "2026-10", "2026-11"].map((period, index) => ({
    id: `tx-sp-${period}`, title: "Spotify", amount: 21.9, type: "despesa", account: "Nubank", cardId: "nu",
    recurringItemId: "rec-spotify", periodKey: period, occurredAt: new Date(2026, 8 + index, 15, 12),
  }));
  const moved = { ...spotify, ...buildForwardRecurringUpdate(spotify, "2026-12", { cardId: "inter", account: "Inter" }) };
  const today = new Date(2026, 10, 24, 12);

  const nu = buildCardStatement(nubank, posted, [moved], { today });
  const it = buildCardStatement(inter, posted, [moved], { today });

  // Cobrança de 15/nov continua no Nubank (fatura de dezembro).
  assert.equal(nu.getInvoice("2026-12").charges.length, 1);
  // Cobrança de 15/dez em diante vai para o Inter (fecha 20 → vence 28/dez).
  assert.equal(nu.getInvoice("2027-01").charges.length, 0);
  assert.equal(it.getInvoice("2026-12").charges.length, 1);
  assert.equal(it.getInvoice("2026-12").charges[0].chargeDate.getDate(), 15);
  assert.equal(it.subscriptions.length, 1);
  assert.equal(nu.subscriptions.length, 0);
});

test("excluir 'desta em diante' não apaga meses anteriores nem gera novas cobranças", () => {
  const { item, entries } = purchase400in2x();
  const ended = { ...item, endPeriodKey: "2026-12" };
  const today = new Date(2026, 10, 24, 12);
  const s = buildCardStatement(nubank, entries, [ended], { today });
  assert.equal(s.getInvoice("2026-12").total, 200, "a parcela já lançada continua");
  assert.equal(s.getInvoice("2027-01").total, 0, "a parcela seguinte some");
  assert.equal(s.usedLimit, 200);
  assert.equal(isRecurringActiveInMonth(ended, 2026, 11), false);
  assert.deepEqual(getPendingDueOccurrences([ended], [nubank, checking], entries, new Date(2027, 0, 30, 12)), []);
});

test("assinatura futura não ocupa limite; parcela de compra já feita ocupa", () => {
  const today = new Date(2026, 10, 24, 12);
  const netflix = {
    id: "rec-netflix", title: "Netflix", amount: 55.9, type: "expense", account: "Nubank", cardId: "nu",
    category: "Assinaturas", dueDay: 28, startYear: 2026, startMonth: 10, active: true,
  };
  const futurePurchase = {
    id: "rec-future", title: "Viagem", amount: 300, type: "expense", account: "Nubank", cardId: "nu",
    category: "Lazer", dueDay: 5, installmentsCount: 3, startYear: 2027, startMonth: 2, active: true,
  };
  const s = buildCardStatement(nubank, [], [netflix, futurePurchase], { today });
  assert.equal(s.usedLimit, 0);
  assert.equal(s.getInvoice("2026-12").total, 55.9, "mas aparece como previsto na fatura");
});

test("estorno no cartão abate da fatura do ciclo em que ocorreu", () => {
  const today = new Date(2026, 10, 24, 12);
  const entries = [
    { id: "c1", title: "Tênis", amount: 300, type: "despesa", account: "Nubank", cardId: "nu", occurredAt: new Date(2026, 10, 10, 12) },
    { id: "r1", title: "Estorno Tênis", amount: 300, type: "receita", account: "Nubank", cardId: "nu", kind: "regular", occurredAt: new Date(2026, 10, 15, 12) },
  ];
  const s = buildCardStatement(nubank, entries, [], { today });
  assert.equal(s.getInvoice("2026-12").total, 0);
  assert.equal(s.usedLimit, 0);
});

test("dados malformados (início em texto, NaN, objeto) não travam o cálculo", () => {
  const today = new Date(2026, 10, 24, 12);
  const base = { id: "bad", title: "X", amount: 10, type: "expense", account: "Nubank", cardId: "nu", category: "c", dueDay: 5, active: true };
  for (const extra of [
    { startMonth: "Outubro", startYear: 2026 },
    { startMonth: 9, startYear: "abc" },
    { startMonth: null, startYear: null },
    { startMonth: NaN, startYear: 2026 },
    { startYear: { seconds: 1 } },
    { startMonth: 9, startYear: 2026, installmentsCount: 5, dueDay: "x" },
  ]) {
    const started = Date.now();
    const s = buildCardStatement(nubank, [], [{ ...base, ...extra }], { today });
    assert.ok(Date.now() - started < 1000, `travou com ${JSON.stringify(extra)}`);
    assert.ok(Number.isFinite(s.usedLimit));
    assert.equal(getPendingDueOccurrences([{ ...base, ...extra }], [nubank], [], today).length >= 0, true);
  }
});
