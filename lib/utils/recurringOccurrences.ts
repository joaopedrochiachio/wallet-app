import type { CardItem, RecurringItem } from "../../types/index.ts";
import { getEffectiveRecurringItemForPeriod, getPeriodKey } from "./dateUtils.ts";
import { getLedgerEntryDate, matchesLedgerCard, type LedgerEntry } from "./ledger.ts";

/** Competência e vínculo têm prioridade sobre o dia em que um atraso foi finalmente pago. */
export function hasRecordedRecurringOccurrence(
  item: RecurringItem, periodKey: string, entries: LedgerEntry[], cards: CardItem[],
  expectedType: LedgerEntry["type"] = item.type === "income" ? "receita" : "despesa"
): boolean {
  const effective = getEffectiveRecurringItemForPeriod(item, periodKey);
  const account = cards.find((card) => matchesLedgerCard(card, effective.account, effective.cardId));
  return entries.some((entry) => {
    if (entry.type !== expectedType || entry.id?.startsWith("planned-") ||
      entry.kind === "invoice_payment" || entry.kind === "invoice_settlement" || entry.kind === "balance_reconciliation") return false;
    const date = getLedgerEntryDate(entry);
    const entryPeriod = entry.periodKey || (date ? getPeriodKey(date.getFullYear(), date.getMonth()) : "");
    if (entryPeriod !== periodKey) return false;
    if (entry.recurringItemId) return entry.recurringItemId === item.id;
    const sameAccount = account ? matchesLedgerCard(account, entry.account, entry.cardId)
      : entry.account?.trim().toLocaleLowerCase("pt-BR") === effective.account?.trim().toLocaleLowerCase("pt-BR");
    return sameAccount && Math.abs(entry.amount - effective.amount) < 0.005 &&
      (entry.title || entry.description)?.trim().toLocaleLowerCase("pt-BR") === effective.title?.trim().toLocaleLowerCase("pt-BR");
  });
}
