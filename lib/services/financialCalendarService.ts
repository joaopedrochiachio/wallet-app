import type { CardItem, RecurringItem } from "../../types/index.ts";
import {
  calculateInvoiceScheduleWithCredits,
  getCardInvoiceRecurringDetails,
  getLedgerEntryDate,
  type LedgerEntry,
} from "../utils/ledger.ts";
import {
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
  getPeriodKey,
  getRecurringMonthOffset,
} from "../utils/dateUtils.ts";

export interface FinancialCalendarTransaction extends LedgerEntry {
  id?: string;
  title?: string;
  description?: string;
  account: string;
  date?: string | Date | null;
}

export interface FinancialCalendarTransactionItem {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  account?: string;
  cardName?: string;
  occurredAt: Date;
  timeLabel?: string;
}

export interface FinancialCalendarBillItem {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income" | "credit_invoice";
  status: "pending" | "paid" | "scheduled_card";
  source: "recurring" | "credit_invoice";
  sourceItem?: RecurringItem;
}

export interface FinancialCalendarDay {
  day: number;
  realizedIncome: number;
  realizedExpense: number;
  realizedNet: number;
  plannedIncome: number;
  plannedExpense: number;
  plannedNet: number;
  transactions: FinancialCalendarTransactionItem[];
  bills: FinancialCalendarBillItem[];
  hasCardInvoice: boolean;
  hasUrgentBill: boolean;
}

export interface CalendarInvoiceProjection {
  cardId: string;
  totalInvoice: number;
  pendingInvoice?: number;
  isPaid: boolean;
}

export interface BuildFinancialCalendarParams {
  year: number;
  month: number;
  cards: CardItem[];
  recurringItems: RecurringItem[];
  transactions: FinancialCalendarTransaction[];
  currentMonthInvoices?: CalendarInvoiceProjection[];
  now?: Date;
}

function isRecurringScheduledForPeriod(
  item: RecurringItem,
  year: number,
  month: number,
  periodKey: string
): boolean {
  if (!item.active) return false;
  if (item.excludedPeriods?.includes(periodKey)) return false;
  if (item.overrides?.[periodKey]?.isDeleted) return false;

  const monthOffset = getRecurringMonthOffset(item, year, month);
  if (monthOffset < 0) return false;
  return !item.installmentsCount || item.installmentsCount <= 0 || monthOffset < item.installmentsCount;
}

function isCreditRecurring(item: RecurringItem, cards: CardItem[]): boolean {
  return cards.some((card) => {
    if (card.type !== "credit") return false;
    const account = item.account.trim().toLocaleLowerCase("pt-BR");
    return card.id === item.cardId || card.id === item.account || card.name.trim().toLocaleLowerCase("pt-BR") === account;
  });
}

function wasRecurringRealized(
  item: RecurringItem,
  periodKey: string,
  transactions: FinancialCalendarTransaction[]
): boolean {
  if (item.realizedPeriods?.includes(periodKey)) return true;
  return transactions.some((transaction) => {
    if (transaction.recurringItemId !== item.id) return false;
    if (transaction.periodKey === periodKey) return true;
    const occurredAt = getLedgerEntryDate(transaction);
    return Boolean(
      occurredAt && getPeriodKey(occurredAt.getFullYear(), occurredAt.getMonth()) === periodKey
    );
  });
}

function createEmptyDay(day: number): FinancialCalendarDay {
  return {
    day,
    realizedIncome: 0,
    realizedExpense: 0,
    realizedNet: 0,
    plannedIncome: 0,
    plannedExpense: 0,
    plannedNet: 0,
    transactions: [],
    bills: [],
    hasCardInvoice: false,
    hasUrgentBill: false,
  };
}

/**
 * Constrói uma visão diária única para lançamentos realizados, recorrências e
 * faturas. Datas reais usam occurredAt/createdAt antes do rótulo amigável date,
 * evitando que lançamentos como "31 de out., 09:30" desapareçam do calendário.
 */
export function buildFinancialCalendar({
  year,
  month,
  cards,
  recurringItems,
  transactions,
  currentMonthInvoices,
  now = new Date(),
}: BuildFinancialCalendarParams): Map<number, FinancialCalendarDay> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const periodKey = getPeriodKey(year, month);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
  const days = new Map<number, FinancialCalendarDay>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.set(day, createEmptyDay(day));
  }

  for (const transaction of transactions) {
    if (transaction.kind === "invoice_settlement" || transaction.id?.startsWith("planned-")) continue;
    const occurredAt = getLedgerEntryDate(transaction);
    if (!occurredAt || occurredAt.getFullYear() !== year || occurredAt.getMonth() !== month) continue;

    const day = days.get(occurredAt.getDate());
    if (!day) continue;
    const amount = Math.abs(Number(transaction.amount) || 0);
    const isIncome = transaction.type === "receita";
    const cardName = transaction.cardId
      ? cards.find((card) => card.id === transaction.cardId)?.name
      : undefined;

    if (isIncome) day.realizedIncome += amount;
    else day.realizedExpense += amount;
    day.realizedNet = day.realizedIncome - day.realizedExpense;
    day.transactions.push({
      id: transaction.id || `${periodKey}-${occurredAt.getDate()}-${day.transactions.length}`,
      title: transaction.title || transaction.description || (isIncome ? "Entrada" : "Saída"),
      amount,
      type: isIncome ? "income" : "expense",
      category: transaction.category || (isIncome ? "Renda" : "Outros"),
      account: transaction.account,
      cardName,
      occurredAt,
      timeLabel: occurredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    });
  }

  for (const rawItem of recurringItems) {
    if (!isRecurringScheduledForPeriod(rawItem, year, month, periodKey)) continue;
    const item = getEffectiveRecurringItemForPeriod(rawItem, periodKey);
    const dueDay = Math.min(daysInMonth, Math.max(1, getEffectiveDueDay(item, year, month)));
    const day = days.get(dueDay);
    if (!day) continue;

    const isIncome = item.type === "income";
    const isCardCharge = isCreditRecurring(item, cards);
    const isPaid = wasRecurringRealized(rawItem, periodKey, transactions);
    const status: FinancialCalendarBillItem["status"] = isPaid
      ? "paid"
      : isCardCharge
        ? "scheduled_card"
        : "pending";

    day.bills.push({
      id: `recurring-${rawItem.id}`,
      title: item.title,
      amount: Math.abs(item.amount),
      type: isIncome ? "income" : "expense",
      status,
      source: "recurring",
      sourceItem: rawItem,
    });

    if (!isPaid && !isCardCharge) {
      if (isIncome) day.plannedIncome += Math.abs(item.amount);
      else day.plannedExpense += Math.abs(item.amount);
      day.plannedNet = day.plannedIncome - day.plannedExpense;
    }

    if (
      !isIncome &&
      !isPaid &&
      !isCardCharge &&
      isCurrentMonth &&
      dueDay >= now.getDate() &&
      dueDay <= now.getDate() + 3
    ) {
      day.hasUrgentBill = true;
    }
  }

  for (const card of cards.filter((candidate) => candidate.type === "credit")) {
    const projected = isCurrentMonth
      ? currentMonthInvoices?.find((invoice) => invoice.cardId === card.id)
      : undefined;
    const schedule = calculateInvoiceScheduleWithCredits(card, transactions, now).schedule;
    const recurringDetails = getCardInvoiceRecurringDetails(card, recurringItems, year, month, transactions);
    const derivedPending = Math.max(0, (schedule[periodKey] || 0) + recurringDetails.pendingAmount);
    const amount = projected ? Math.max(0, projected.pendingInvoice ?? projected.totalInvoice) : derivedPending;
    const isPaid = projected ? projected.isPaid : amount === 0;

    if (amount <= 0 && !isPaid) continue;
    if (amount <= 0) continue;

    const dueDay = Math.min(daysInMonth, Math.max(1, card.dueDay || 10));
    const day = days.get(dueDay);
    if (!day) continue;

    day.hasCardInvoice = true;
    day.bills.push({
      id: `invoice-${card.id}`,
      title: `Fatura ${card.name}`,
      amount,
      type: "credit_invoice",
      status: isPaid ? "paid" : "pending",
      source: "credit_invoice",
    });

    if (!isPaid) {
      day.plannedExpense += amount;
      day.plannedNet = day.plannedIncome - day.plannedExpense;
      if (
        isCurrentMonth &&
        dueDay >= now.getDate() &&
        dueDay <= now.getDate() + 3
      ) {
        day.hasUrgentBill = true;
      }
    }
  }

  days.forEach((day) => {
    day.transactions.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    day.bills.sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return a.title.localeCompare(b.title, "pt-BR");
    });
  });

  return days;
}

export function summarizeFinancialCalendar(days: Map<number, FinancialCalendarDay>) {
  let realizedIncome = 0;
  let realizedExpense = 0;
  let plannedIncome = 0;
  let plannedExpense = 0;

  days.forEach((day) => {
    realizedIncome += day.realizedIncome;
    realizedExpense += day.realizedExpense;
    plannedIncome += day.plannedIncome;
    plannedExpense += day.plannedExpense;
  });

  return {
    realizedIncome,
    realizedExpense,
    realizedNet: realizedIncome - realizedExpense,
    plannedIncome,
    plannedExpense,
    plannedNet: plannedIncome - plannedExpense,
  };
}
