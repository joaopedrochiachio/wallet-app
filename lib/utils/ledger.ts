import type { CardItem } from "@/types";

export interface LedgerEntry {
  amount: number;
  type: "despesa" | "receita";
  account: string;
  cardId?: string | null;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
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
    matchesLedgerCard(card, entry.account, entry.cardId)
  );
  const openingBalance = card.openingBalance ??
    (accountEntries.length === 0 ? card.balance ?? 0 : 0);

  return accountEntries.reduce(
    (balance, entry) => balance + (entry.type === "receita" ? entry.amount : -entry.amount),
    openingBalance
  );
}

/** Fatura = compras - estornos - baixas, nunca menor que zero. */
export function calculateCreditInvoice(card: CardItem, entries: LedgerEntry[]): number {
  const invoice = entries
    .filter((entry) => matchesLedgerCard(card, entry.account, entry.cardId))
    .reduce(
      (total, entry) => total + (entry.type === "despesa" ? entry.amount : -entry.amount),
      0
    );
  return Math.max(0, invoice);
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
    matchesLedgerCard(card, item.account, item.cardId)
  )) {
    if (entry.type === "receita") {
      credits += entry.amount;
      continue;
    }
    const dueDate = getInvoiceDueDate(card, getLedgerEntryDate(entry) || fallbackDate);
    const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}`;
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
