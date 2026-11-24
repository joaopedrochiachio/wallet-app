/**
 * Motor único de cartões de crédito.
 *
 * Tudo o que a interface mostra sobre um cartão (faturas, limite, parcelas,
 * assinaturas) sai daqui, para que Cartões, Planejamento, dashboard e Cofi
 * nunca discordem entre si.
 *
 * Regras (iguais às de um cartão real):
 * - Uma fatura é identificada pelo mês de VENCIMENTO (ex.: "2027-01" = fatura
 *   de janeiro). Ela reúne as compras do ciclo que fechou antes desse vencimento
 *   (ex.: fecha dia 3 → compras de 04/dez a 03/jan → "gastos de dezembro").
 * - Compra parcelada consome o limite inteiro na hora; cada fatura recebe só a
 *   parcela daquele mês.
 * - Cada real pago devolve um real de limite, mesmo em pagamento parcial.
 *   Pagar mais do que a fatura vira crédito para as faturas seguintes.
 * - Faturas com vencimento em meses anteriores ao atual são consideradas
 *   encerradas (o app não cobra o passado que você já quitou no banco).
 */
import type { CardItem, RecurringItem } from "@/types";
import {
  MONTH_NAMES_PT,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
  getPeriodKey,
  getRecurringMonthOffset,
  getRecurringStartPeriod,
  isInstallmentPaidInMonth,
  isRecurringEndedInMonth,
} from "./dateUtils.ts";
import {
  getInvoiceDueDate,
  getLedgerEntryDate,
  isInvoicePaymentOrSettlement,
  matchesLedgerCard,
  type LedgerEntry,
} from "./ledger.ts";

export type CardChargeKind = "purchase" | "installment" | "subscription" | "refund";

export interface CardCharge {
  id: string;
  cardId: string;
  kind: CardChargeKind;
  /** posted = já está no extrato do cartão; scheduled = cobrança prevista. */
  status: "posted" | "scheduled";
  title: string;
  category: string;
  /** Sempre positivo. Estornos usam kind "refund". */
  amount: number;
  chargeDate: Date;
  invoiceKey: string;
  /** Competência da cobrança (mês em que ela acontece), usada por séries recorrentes. */
  chargePeriodKey: string;
  recurringItemId: string | null;
  transactionId: string | null;
  installmentIndex?: number;
  installmentsCount?: number;
  entry?: LedgerEntry;
  item?: RecurringItem;
}

export type InvoiceStatus =
  | "empty"
  | "open"
  | "closed"
  | "overdue"
  | "paid"
  | "settled"
  | "future";

export interface CardInvoice {
  cardId: string;
  key: string;
  year: number;
  month: number;
  dueDate: Date;
  closingDate: Date;
  cycleStart: Date;
  /** Mês predominante dos gastos do ciclo (ex.: fatura de janeiro → dezembro). */
  referenceYear: number;
  referenceMonth: number;
  charges: CardCharge[];
  purchasesTotal: number;
  refundsTotal: number;
  /** Valor da fatura (compras − estornos). Não muda depois de paga. */
  total: number;
  paid: number;
  /** Crédito vindo de pagamento antecipado/estorno de faturas anteriores. */
  creditApplied: number;
  outstanding: number;
  status: InvoiceStatus;
  isCurrentCycle: boolean;
}

export interface InstallmentPlanSummary {
  recurringItemId: string;
  cardId: string;
  title: string;
  category: string;
  installmentsCount: number;
  installmentAmount: number;
  totalAmount: number;
  /** Parcelas que já entraram em alguma fatura (cobradas até hoje). */
  chargedCount: number;
  remainingCount: number;
  remainingAmount: number;
  nextCharge: CardCharge | null;
  lastInvoiceKey: string | null;
  purchaseDate: Date;
  item: RecurringItem;
}

export interface SubscriptionSummary {
  recurringItemId: string;
  cardId: string;
  title: string;
  category: string;
  amount: number;
  nextCharge: CardCharge | null;
  item: RecurringItem;
}

export interface CardStatement {
  card: CardItem;
  today: Date;
  currentMonthKey: string;
  /** Fatura que está acumulando as compras de hoje. */
  currentCycleKey: string;
  invoices: CardInvoice[];
  usedLimit: number;
  availableLimit: number;
  percentUsed: number;
  /** Total a pagar até a fatura atual (fechadas não pagas + fatura atual). */
  amountDue: number;
  /** Parcelas e compras já feitas que ainda vão cair em faturas futuras. */
  futureCommitted: number;
  plans: InstallmentPlanSummary[];
  subscriptions: SubscriptionSummary[];
  getInvoice: (key: string) => CardInvoice;
}

export interface BuildCardStatementOptions {
  today?: Date;
  /** Quantos meses de assinaturas projetar à frente. */
  horizonMonths?: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const EPSILON = 0.005;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export function shiftPeriodKey(key: string, offset: number): string {
  const { year, month } = parseKey(key);
  const date = new Date(year, month + offset, 1);
  return getPeriodKey(date.getFullYear(), date.getMonth());
}

function keyOf(date: Date): string {
  return getPeriodKey(date.getFullYear(), date.getMonth());
}

function clampDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(1, day), last), 12);
}

/** Datas do ciclo da fatura que vence no mês `key`. */
export function getInvoiceCycle(card: CardItem, key: string) {
  const { year, month } = parseKey(key);
  const closingDay = Math.min(31, Math.max(1, card.closingDay || 1));
  const dueDay = Math.min(31, Math.max(1, card.dueDay || closingDay));
  const closingMonthOffset = dueDay <= closingDay ? -1 : 0;
  const closingRef = new Date(year, month + closingMonthOffset, 1);
  const closingDate = clampDay(closingRef.getFullYear(), closingRef.getMonth(), closingDay);
  const prevClosingRef = new Date(closingRef.getFullYear(), closingRef.getMonth() - 1, 1);
  const prevClosing = clampDay(prevClosingRef.getFullYear(), prevClosingRef.getMonth(), closingDay);
  const cycleStart = new Date(prevClosing.getFullYear(), prevClosing.getMonth(), prevClosing.getDate() + 1, 12);
  const dueDate = clampDay(year, month, dueDay);
  const midpoint = new Date((cycleStart.getTime() + closingDate.getTime()) / 2);
  return {
    year,
    month,
    dueDate,
    closingDate,
    cycleStart,
    referenceYear: midpoint.getFullYear(),
    referenceMonth: midpoint.getMonth(),
  };
}

function isActual(entry: LedgerEntry): boolean {
  return !entry.id?.startsWith("planned-");
}

function entryPeriodKey(entry: LedgerEntry): string | null {
  if (entry.periodKey) return entry.periodKey;
  const date = getLedgerEntryDate(entry);
  return date ? keyOf(date) : null;
}

function getRecurringStart(item: RecurringItem, reference: Date) {
  const start = getRecurringStartPeriod(item, reference.getFullYear());
  return new Date(start.year, start.month, 1);
}

function classifyRecurring(item: RecurringItem): CardChargeKind {
  if (item.installmentsCount && item.installmentsCount > 1) return "installment";
  if (item.installmentsCount === 1) return "purchase";
  return "subscription";
}

function isSettlementLeg(entry: LedgerEntry, card: CardItem): boolean {
  if (!isActual(entry)) return false;
  if (entry.kind === "invoice_settlement" || entry.kind === "invoice_payment") {
    return isInvoicePaymentOrSettlement(entry, card);
  }
  // Receita comum no cartão é estorno; o resto segue a regra legada.
  if (entry.type === "receita" && matchesLedgerCard(card, entry.account, entry.cardId)) {
    return false;
  }
  return isInvoicePaymentOrSettlement(entry, card);
}

/**
 * Gera o extrato completo do cartão: todas as faturas (passadas, atual e
 * futuras), o limite usado e o resumo de parcelamentos e assinaturas.
 */
export function buildCardStatement(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  options: BuildCardStatementOptions = {}
): CardStatement {
  const today = options.today ?? new Date();
  const todayStart = startOfDay(today);
  const horizonMonths = options.horizonMonths ?? 14;
  const currentMonthKey = keyOf(today);
  const currentCycleKey = keyOf(getInvoiceDueDate(card, today));
  const itemsById = new Map(recurringItems.map((item) => [item.id, item]));

  const charges: CardCharge[] = [];
  const explicitPayments = new Map<string, number>();
  const legacyPayments = new Map<string, number>();
  const seenPaymentGroups = new Set<string>();
  const postedRecurring = new Set<string>();

  for (const entry of entries) {
    if (!isActual(entry)) continue;
    if (entry.recurringItemId) {
      const period = entryPeriodKey(entry);
      if (period) postedRecurring.add(`${entry.recurringItemId}|${period}`);
    }
    if (entry.kind === "balance_reconciliation") continue;

    if (isSettlementLeg(entry, card)) {
      const group = entry.groupId || entry.id;
      if (group) {
        if (seenPaymentGroups.has(group)) continue;
        seenPaymentGroups.add(group);
      }
      const key = entryPeriodKey(entry);
      if (!key) continue;
      const bucket = entry.periodKey ? explicitPayments : legacyPayments;
      bucket.set(key, (bucket.get(key) || 0) + entry.amount);
      continue;
    }

    if (!matchesLedgerCard(card, entry.account, entry.cardId)) continue;
    if (card.type !== "credit") continue;
    const date = getLedgerEntryDate(entry) || today;
    const invoiceKey = keyOf(getInvoiceDueDate(card, date));
    const item = entry.recurringItemId ? itemsById.get(entry.recurringItemId) : undefined;
    const chargePeriodKey = entryPeriodKey(entry) || keyOf(date);

    if (entry.type === "receita") {
      charges.push({
        id: entry.id || `refund-${date.getTime()}`,
        cardId: card.id,
        kind: "refund",
        status: "posted",
        title: entry.title || entry.description || "Estorno",
        category: entry.category || "Estorno",
        amount: entry.amount,
        chargeDate: date,
        invoiceKey,
        chargePeriodKey,
        recurringItemId: null,
        transactionId: entry.id || null,
        entry,
      });
      continue;
    }

    const kind = item ? classifyRecurring(item) : "purchase";
    const offset = item ? getRecurringMonthOffset(item, parseKey(chargePeriodKey).year, parseKey(chargePeriodKey).month) : 0;
    charges.push({
      id: entry.id || `tx-${date.getTime()}`,
      cardId: card.id,
      kind,
      status: "posted",
      title: entry.title || entry.description || item?.title || "Compra",
      category: entry.category || item?.category || "Outros",
      amount: entry.amount,
      chargeDate: date,
      invoiceKey,
      chargePeriodKey,
      recurringItemId: item ? item.id : null, // série apagada = compra comum
      transactionId: entry.id || null,
      ...(kind === "installment" && item
        ? { installmentIndex: offset + 1, installmentsCount: item.installmentsCount }
        : {}),
      entry,
      item,
    });
  }

  // Cobranças previstas de séries (parcelas ainda não lançadas, assinaturas).
  const plans: InstallmentPlanSummary[] = [];
  const subscriptions: SubscriptionSummary[] = [];

  if (card.type === "credit") {
    for (const item of recurringItems) {
      if (item.type === "income") continue;
      const kind = classifyRecurring(item);
      const start = getRecurringStart(item, today);
      if (Number.isNaN(start.getTime())) continue;
      const count = item.installmentsCount && item.installmentsCount > 0
        ? Math.min(360, item.installmentsCount)
        : null;
      const horizonEnd = new Date(today.getFullYear(), today.getMonth() + horizonMonths, 1);
      const projectionFloor = new Date(today.getFullYear(), today.getMonth() - 12, 1);
      const itemCharges: CardCharge[] = [];
      let belongsToCard = false;
      let totalAmount = 0;

      // Teto rígido: nenhuma série pode gerar mais de 600 meses (evita travar a tela).
      for (let offset = 0; offset < 600; offset++) {
        if (count !== null && offset >= count) break;
        const periodDate = new Date(start.getFullYear(), start.getMonth() + offset, 1);
        if (Number.isNaN(periodDate.getTime())) break;
        if (count === null && periodDate >= horizonEnd) break;
        const year = periodDate.getFullYear();
        const month = periodDate.getMonth();
        const periodKey = getPeriodKey(year, month);
        if (isRecurringEndedInMonth(item, year, month)) break;

        const effective = getEffectiveRecurringItemForPeriod(item, periodKey);
        const onThisCard = matchesLedgerCard(card, effective.account, effective.cardId);
        if (onThisCard && count !== null) totalAmount += effective.amount;
        if (!onThisCard) continue;
        belongsToCard = true;

        if (isInstallmentPaidInMonth(item, year, month)) continue;
        if (item.excludedPeriods?.includes(periodKey) || item.overrides?.[periodKey]?.isDeleted) continue;
        if (count === null && periodDate < projectionFloor) continue;

        const chargeDate = new Date(year, month, getEffectiveDueDay(effective, year, month), 12);
        const invoiceDue = getInvoiceDueDate(card, chargeDate);
        const invoiceKey = keyOf(invoiceDue);
        const posted = postedRecurring.has(`${item.id}|${periodKey}`) ||
          Boolean(item.realizedPeriods?.includes(periodKey));

        const charge: CardCharge = {
          id: `sched-${item.id}-${periodKey}`,
          cardId: card.id,
          kind,
          status: posted ? "posted" : "scheduled",
          title: effective.title,
          category: effective.category,
          amount: effective.amount,
          chargeDate,
          invoiceKey,
          chargePeriodKey: periodKey,
          recurringItemId: item.id,
          transactionId: null,
          ...(kind === "installment" ? { installmentIndex: offset + 1, installmentsCount: count ?? undefined } : {}),
          item: effective,
        };
        itemCharges.push(charge);

        // Lançadas já entram pelo extrato. Fatura que já venceu mostra só o que
        // foi de fato lançado; cobrança desfeita pelo usuário também não volta.
        const undone = Boolean(item.manualConfirmationPeriods?.includes(periodKey)) &&
          startOfDay(chargeDate) <= todayStart;
        if (!posted && !undone && item.active && startOfDay(invoiceDue) >= todayStart) {
          charges.push(charge);
        }
      }

      if (!belongsToCard || !item.active) continue;
      const upcoming = itemCharges.find((charge) => charge.status === "scheduled" && charge.invoiceKey >= currentCycleKey) || null;

      if (kind === "installment" && count !== null) {
        const remaining = itemCharges.filter((charge) => startOfDay(charge.chargeDate) > todayStart && charge.status === "scheduled");
        const chargedCount = Math.min(count, (item.paidInstallmentsCount || 0) + itemCharges.length - remaining.length);
        const lastCharge = itemCharges[itemCharges.length - 1];
        if (remaining.length > 0 || (lastCharge && lastCharge.invoiceKey >= currentCycleKey)) {
          plans.push({
            recurringItemId: item.id,
            cardId: card.id,
            title: item.title,
            category: item.category,
            installmentsCount: count,
            installmentAmount: item.amount,
            totalAmount: round2(totalAmount),
            chargedCount,
            remainingCount: remaining.length,
            remainingAmount: round2(remaining.reduce((sum, charge) => sum + charge.amount, 0)),
            nextCharge: upcoming,
            lastInvoiceKey: lastCharge?.invoiceKey ?? null,
            purchaseDate: new Date(start.getFullYear(), start.getMonth(), getEffectiveDueDay(item, start.getFullYear(), start.getMonth()), 12),
            item,
          });
        }
      } else if (kind === "subscription" && upcoming) {
        subscriptions.push({
          recurringItemId: item.id,
          cardId: card.id,
          title: upcoming.title,
          category: upcoming.category,
          amount: upcoming.amount,
          nextCharge: upcoming,
          item,
        });
      }
    }
  }

  // Agrupa por fatura.
  const byKey = new Map<string, CardCharge[]>();
  for (const charge of charges) {
    const list = byKey.get(charge.invoiceKey) || [];
    list.push(charge);
    byKey.set(charge.invoiceKey, list);
  }
  const keys = new Set<string>([
    ...byKey.keys(),
    ...explicitPayments.keys(),
    ...legacyPayments.keys(),
    currentCycleKey,
  ]);
  const sortedKeys = [...keys].sort();

  // Cobranças que ainda não consomem limite: assinatura/compra avulsa futura
  // e parcelas de compras que ainda nem aconteceram.
  const consumesLimit = (charge: CardCharge) => {
    if (charge.status === "posted" || charge.kind === "refund") return true;
    if (startOfDay(charge.chargeDate) <= todayStart) return true;
    if (charge.kind !== "installment" || !charge.item) return false;
    const source = itemsById.get(charge.recurringItemId || "") || charge.item;
    const start = getRecurringStart(source, today);
    const firstCharge = new Date(start.getFullYear(), start.getMonth(), getEffectiveDueDay(source, start.getFullYear(), start.getMonth()));
    return firstCharge <= todayStart;
  };

  const invoices: CardInvoice[] = [];
  let carry = 0;
  let usedLimit = 0;
  let amountDue = 0;
  let futureCommitted = 0;

  for (const key of sortedKeys) {
    const list = (byKey.get(key) || []).sort((a, b) => a.chargeDate.getTime() - b.chargeDate.getTime());
    const purchasesTotal = round2(list.filter((c) => c.kind !== "refund").reduce((s, c) => s + c.amount, 0));
    const refundsTotal = round2(list.filter((c) => c.kind === "refund").reduce((s, c) => s + c.amount, 0));
    const net = round2(purchasesTotal - refundsTotal);
    const paidExplicit = round2(explicitPayments.get(key) || 0);
    const paidLegacy = round2(legacyPayments.get(key) || 0);

    const carryIn = carry;
    let remaining = Math.max(0, net - paidLegacy);
    const credit = carry + paidExplicit;
    const outstandingRaw = round2(Math.max(0, remaining - credit));
    carry = round2(Math.max(0, credit - remaining) + (net < 0 ? -net : 0));
    remaining = outstandingRaw;

    const cycle = getInvoiceCycle(card, key);
    const autoSettled = key < currentMonthKey && outstandingRaw > EPSILON;
    const outstanding = autoSettled ? 0 : outstandingRaw;
    const paid = round2(paidExplicit + paidLegacy);
    const total = Math.max(0, net);

    let status: InvoiceStatus;
    if (list.length === 0 && paid <= EPSILON) status = "empty";
    else if (outstandingRaw <= EPSILON) status = "paid";
    else if (autoSettled) status = "settled";
    else if (key > currentCycleKey) status = "future";
    else if (key === currentCycleKey) status = "open";
    else status = startOfDay(cycle.dueDate) < todayStart ? "overdue" : "closed";

    if (outstanding > EPSILON) {
      const notYetConsuming = round2(list.filter((c) => c.kind !== "refund" && !consumesLimit(c)).reduce((s, c) => s + c.amount, 0));
      const limitPart = Math.max(0, outstanding - notYetConsuming);
      usedLimit += limitPart;
      if (key <= currentCycleKey) amountDue += outstanding;
      else futureCommitted += limitPart;
    }

    invoices.push({
      cardId: card.id,
      key,
      ...cycle,
      charges: list,
      purchasesTotal,
      refundsTotal,
      total: round2(total),
      paid,
      creditApplied: round2(Math.min(carryIn, Math.max(0, net - paidLegacy))),
      outstanding: round2(outstanding),
      status,
      isCurrentCycle: key === currentCycleKey,
    });
  }

  const invoiceMap = new Map(invoices.map((invoice) => [invoice.key, invoice]));
  const getInvoice = (key: string): CardInvoice => {
    const found = invoiceMap.get(key);
    if (found) return found;
    const cycle = getInvoiceCycle(card, key);
    return {
      cardId: card.id,
      key,
      ...cycle,
      charges: [],
      purchasesTotal: 0,
      refundsTotal: 0,
      total: 0,
      paid: 0,
      creditApplied: 0,
      outstanding: 0,
      status: "empty",
      isCurrentCycle: key === currentCycleKey,
    };
  };

  usedLimit = round2(usedLimit);
  const limit = card.limit || 0;
  plans.sort((a, b) => (a.lastInvoiceKey || "").localeCompare(b.lastInvoiceKey || ""));
  subscriptions.sort((a, b) => b.amount - a.amount);

  return {
    card,
    today,
    currentMonthKey,
    currentCycleKey,
    invoices,
    usedLimit,
    availableLimit: round2(Math.max(0, limit - usedLimit)),
    percentUsed: limit > 0 ? Math.min(100, Math.round((usedLimit / limit) * 100)) : 0,
    amountDue: round2(amountDue),
    futureCommitted: round2(futureCommitted),
    plans,
    subscriptions,
    getInvoice,
  };
}

/* ------------------------------------------------------------------ */
/* Cache: o planejamento consulta o mesmo cartão muitas vezes por render */
/* ------------------------------------------------------------------ */

const statementCache = new WeakMap<object, WeakMap<object, Map<string, CardStatement>>>();

export function getCachedCardStatement(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  today: Date = new Date()
): CardStatement {
  const signature = [
    card.id, card.name, card.limit, card.closingDay, card.dueDay, card.type,
    today.getFullYear(), today.getMonth(), today.getDate(),
  ].join("|");
  let byRecurring = statementCache.get(entries);
  if (!byRecurring) {
    byRecurring = new WeakMap();
    statementCache.set(entries, byRecurring);
  }
  let bySignature = byRecurring.get(recurringItems);
  if (!bySignature) {
    bySignature = new Map();
    byRecurring.set(recurringItems, bySignature);
  }
  const cached = bySignature.get(signature);
  if (cached) return cached;
  const statement = buildCardStatement(card, entries, recurringItems, { today });
  bySignature.set(signature, statement);
  return statement;
}

/* ------------------------------------------------------------------ */
/* Textos explicativos                                                  */
/* ------------------------------------------------------------------ */

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatShortDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${SHORT_MONTHS[date.getMonth()]}`;
}

export function monthName(month: number): string {
  return MONTH_NAMES_PT[month];
}

export function monthNameLower(month: number): string {
  return MONTH_NAMES_PT[month].toLocaleLowerCase("pt-BR");
}

/** "Fatura de Janeiro" */
export function invoiceTitle(invoice: Pick<CardInvoice, "month" | "year">, withYear = false): string {
  return `Fatura de ${monthName(invoice.month)}${withYear ? ` ${invoice.year}` : ""}`;
}

/** "gastos de dezembro · 04/dez a 03/jan" */
export function invoiceReference(invoice: Pick<CardInvoice, "referenceMonth" | "cycleStart" | "closingDate">): string {
  return `gastos de ${monthNameLower(invoice.referenceMonth)} · ${formatShortDate(invoice.cycleStart)} a ${formatShortDate(invoice.closingDate)}`;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  empty: "Sem compras",
  open: "Aberta",
  closed: "Fechada",
  overdue: "Vencida",
  paid: "Paga",
  settled: "Encerrada",
  future: "Prevista",
};

export function describeInvoiceStatus(invoice: CardInvoice, today: Date = new Date()): string {
  const due = formatShortDate(invoice.dueDate);
  const close = formatShortDate(invoice.closingDate);
  switch (invoice.status) {
    case "open":
      return startOfDay(invoice.closingDate) >= startOfDay(today)
        ? `Recebendo compras até ${close} · vence ${due}`
        : `Vence ${due}`;
    case "closed":
      return `Fechou ${close} · vence ${due}`;
    case "overdue":
      return `Venceu ${due} · ainda falta pagar`;
    case "paid":
      return invoice.paid > 0 ? `Paga · venceu ${due}` : `Quitada com crédito · ${due}`;
    case "settled":
      return `Encerrada · venceu ${due}`;
    case "future":
      return `Abre ${formatShortDate(invoice.cycleStart)} · fecha ${close} · vence ${due}`;
    default:
      return `Fecha ${close} · vence ${due}`;
  }
}

export function chargeKindLabel(charge: Pick<CardCharge, "kind" | "installmentIndex" | "installmentsCount">): string {
  switch (charge.kind) {
    case "installment":
      return `Parcela ${charge.installmentIndex}/${charge.installmentsCount}`;
    case "subscription":
      return "Assinatura";
    case "refund":
      return "Estorno";
    default:
      return "À vista";
  }
}
