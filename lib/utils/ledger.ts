import type { CardItem, RecurringItem } from "@/types";
import {
  getPeriodKey,
  getRecurringMonthOffset,
  getEffectiveRecurringItemForPeriod,
} from "./dateUtils.ts";

export interface LedgerEntry {
  id?: string;
  amount: number;
  type: "despesa" | "receita";
  account: string;
  cardId?: string | null;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  periodKey?: string | null;
}

export interface AccountFlow {
  income: number;
  outflow: number;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

/** Compatibilidade: previsões antigas chegaram a ser gravadas como lançamentos reais. */
function isActualEntry(entry: LedgerEntry): boolean {
  return !entry.id?.startsWith("planned-");
}

export function formatAccountLabel(value: string): string {
  const withoutDebitSuffix = value.replace(/\s*\(débito(?:\s*\/\s*pix)?\)\s*$/iu, "").trim();
  return normalizeText(withoutDebitSuffix) === normalizeText("Débito/Pix")
    ? "Conta principal"
    : withoutDebitSuffix;
}

export function matchesLedgerCard(
  card: CardItem,
  account: string,
  cardId?: string | null
): boolean {
  return card.id === cardId ||
    card.id === account ||
    normalizeText(card.name) === normalizeText(account) ||
    (card.type === "checking" && account === "Débito/Pix");
}

/** Saldo da conta = saldo inicial + entradas - saídas do livro-caixa. */
export function calculateCheckingBalance(card: CardItem, entries: LedgerEntry[]): number {
  const accountEntries = entries.filter((entry) =>
    isActualEntry(entry) && matchesLedgerCard(card, entry.account, entry.cardId)
  );
  const openingBalance = card.openingBalance ??
    (accountEntries.length === 0 ? card.balance ?? 0 : 0);

  return accountEntries.reduce(
    (balance, entry) => balance + (entry.type === "receita" ? entry.amount : -entry.amount),
    openingBalance
  );
}

/**
 * Fatura real aberta e comprometimento do cartão de crédito:
 * - Se recurringItems for fornecido: calcula a fatura da competência aberta atual,
 *   somando compras faturadas (via calculateInvoiceSchedule) e assinaturas/recorrências
 *   ativas alocadas a este cartão (ex: Apple, Spotify, iCloud), abatendo baixas e pagamentos efetuados.
 * - Caso contrário (ou fallback): calcula compras brutas menos estornos e baixas.
 */
export function calculateCreditInvoice(
  card: CardItem,
  entries: LedgerEntry[],
  recurringItems: RecurringItem[] = [],
  referenceDate: Date = new Date()
): number {
  if (card.type !== "credit") return 0;

  // 1. Data de vencimento da fatura aberta do cartão
  const openDueDate = getInvoiceDueDate(card, referenceDate);
  const openPeriodKey = getPeriodKey(openDueDate.getFullYear(), openDueDate.getMonth());

  // 2. Compras e parcelas faturadas para esta competência ou competências pendentes
  const schedule = calculateInvoiceSchedule(card, entries, referenceDate);
  let installmentsAmount = 0;
  for (const [key, amount] of Object.entries(schedule)) {
    if (key <= openPeriodKey) {
      installmentsAmount += amount;
    }
  }

  // 3. Assinaturas e cobranças recorrentes ativas que caem nesta fatura
  let recurringAmount = 0;
  if (recurringItems && recurringItems.length > 0) {
    const matchingCreditItems = recurringItems.filter((candidate) =>
      candidate.type !== "income" &&
      matchesLedgerCard(card, candidate.account, candidate.cardId)
    );

    for (const rawItem of matchingCreditItems) {
      const item = getEffectiveRecurringItemForPeriod(rawItem, openPeriodKey);
      const monthOffset = getRecurringMonthOffset(item, openDueDate.getFullYear(), openDueDate.getMonth());
      const isScheduledForMonth = monthOffset >= 0 && (
        !item.installmentsCount ||
        item.installmentsCount <= 0 ||
        monthOffset < item.installmentsCount
      );

      if (!item.active || !isScheduledForMonth) continue;
      if (item.excludedPeriods?.includes(openPeriodKey) || item.overrides?.[openPeriodKey]?.isDeleted) continue;

      const isRealizedInPeriod = Boolean(item.realizedPeriods?.includes(openPeriodKey));
      const isAlreadyInTransactions = entries.some((t: any) =>
        t.recurringItemId === item.id && (
          t.periodKey === openPeriodKey ||
          (calculateInvoiceSchedule(card, [t], referenceDate)[openPeriodKey] || 0) > 0
        )
      );

      if (!isRealizedInPeriod && !isAlreadyInTransactions) {
        recurringAmount += item.amount;
      }
    }
  }

  // 4. Pagamentos de fatura da conta corrente já efetuados nesta competência
  const paidAmount = entries
    .filter((t: any) =>
      t.type === "despesa" &&
      t.kind === "invoice_payment" &&
      (t.relatedCardId === card.id || matchesLedgerCard(card, t.account, t.cardId)) &&
      (t.periodKey === openPeriodKey || (getLedgerEntryDate(t) && getPeriodKey(getLedgerEntryDate(t)!.getFullYear(), getLedgerEntryDate(t)!.getMonth()) === openPeriodKey))
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOwed = Math.max(0, installmentsAmount + recurringAmount - paidAmount);

  // Fallback: se não houver faturas distribuídas mas houver despesas avulsas brutas
  if (totalOwed === 0 && schedule[openPeriodKey] === undefined && recurringAmount === 0) {
    const rawInvoice = entries
      .filter((entry) => isActualEntry(entry) && matchesLedgerCard(card, entry.account, entry.cardId))
      .reduce(
        (total, entry) => total + (entry.type === "despesa" ? entry.amount : -entry.amount),
        0
      );
    return Math.max(0, rawInvoice);
  }

  return totalOwed;
}

export function getLedgerEntryDate(entry: LedgerEntry): Date | null {
  const raw = entry.occurredAt || entry.createdAt;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number" || typeof raw === "string") {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Fluxo efetivamente realizado nas contas durante um mês.
 * Compras no crédito e itens apenas planejados não fazem parte deste total.
 */
export function calculateMonthlyAccountFlow(
  cards: CardItem[],
  entries: LedgerEntry[],
  targetDate: Date = new Date()
): AccountFlow {
  const primaryAccount = cards.find((card) => card.type === "checking");
  if (!primaryAccount) return { income: 0, outflow: 0 };

  const accountEntries = entries.filter((entry) => {
    const occurredAt = getLedgerEntryDate(entry);
    const isTargetMonth = occurredAt &&
      occurredAt.getMonth() === targetDate.getMonth() &&
      occurredAt.getFullYear() === targetDate.getFullYear();

    return isActualEntry(entry) && Boolean(isTargetMonth) &&
      matchesLedgerCard(primaryAccount, entry.account, entry.cardId);
  });

  return accountEntries.reduce<AccountFlow>(
    (flow, entry) => {
      if (entry.type === "receita") flow.income += entry.amount;
      else flow.outflow += entry.amount;
      return flow;
    },
    { income: 0, outflow: 0 }
  );
}

/** Calcula em qual mês uma compra entra na fatura, pelo fechamento e vencimento. */
export function getInvoiceDueDate(card: CardItem, purchaseDate: Date): Date {
  const closingDay = Math.min(31, Math.max(1, card.closingDay || 1));
  const dueDay = Math.min(31, Math.max(1, card.dueDay || closingDay));
  const closingMonthOffset = purchaseDate.getDate() > closingDay ? 1 : 0;
  const dueMonthOffset = closingMonthOffset + (dueDay <= closingDay ? 1 : 0);
  const dueMonth = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + dueMonthOffset, 1);
  const lastDay = new Date(dueMonth.getFullYear(), dueMonth.getMonth() + 1, 0).getDate();
  return new Date(dueMonth.getFullYear(), dueMonth.getMonth(), Math.min(dueDay, lastDay));
}

/**
 * Distribui a fatura aberta por mês de vencimento. Créditos e pagamentos
 * liquidam primeiro as cobranças mais antigas.
 */
export function calculateInvoiceSchedule(
  card: CardItem,
  entries: LedgerEntry[],
  fallbackDate: Date = new Date()
): Record<string, number> {
  const charges = new Map<string, number>();
  let credits = 0;

  for (const entry of entries.filter((item) =>
    isActualEntry(item) && matchesLedgerCard(card, item.account, item.cardId)
  )) {
    if (entry.type === "receita") {
      credits += entry.amount;
      continue;
    }
    const dueDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || fallbackDate);
    const key = entry.periodKey || `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
    charges.set(key, (charges.get(key) || 0) + entry.amount);
  }

  const result: Record<string, number> = {};
  for (const key of [...charges.keys()].sort()) {
    const charge = charges.get(key) || 0;
    const appliedCredit = Math.min(charge, credits);
    credits -= appliedCredit;
    result[key] = Math.max(0, charge - appliedCredit);
  }
  return result;
}

/**
 * Calcula o saldo projetado acumulando o saldo transportado do mês anterior (openingBalance)
 * com as entradas previstas menos as saídas comprometidas.
 */
export function calculateProjectedBalance(
  openingBalance: number,
  income: number,
  committed: number
): number {
  return openingBalance + income - committed;
}
