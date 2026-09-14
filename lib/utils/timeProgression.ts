import type { CardItem, RecurringItem } from "@/types";
import {
  getEffectiveDueDay,
  getPeriodKey,
  MONTH_NAMES_PT,
} from "./dateUtils.ts";

export interface DueOccurrence {
  occurrenceId: string;
  recurringItemId: string;
  periodKey: string;
  dueDate: Date;
  formattedDate: string;
  amount: number;
  type: "in" | "out";
  description: string;
  category: string;
  paymentMethod: string;
  cardId: string | null;
  isCredit: boolean;
}

export interface ExistingTransactionRef {
  id?: string;
  recurringItemId?: string | null;
  periodKey?: string | null;
}

/**
 * Cria uma data no meio do dia (12:00:00) local para evitar desvios
 * causados por fusos horários negativos (ex: UTC-3 Brasil) ao converter para string.
 */
export function createSafeMiddayDate(
  year: number,
  monthIndex: number,
  day: number
): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

/**
 * Compara se date1 é o mesmo dia de calendário civil ou anterior a date2.
 * Ignora horas, minutos e segundos.
 */
export function isSameOrBeforeCalendarDay(date1: Date, date2: Date): boolean {
  const y1 = date1.getFullYear();
  const y2 = date2.getFullYear();
  if (y1 !== y2) return y1 < y2;

  const m1 = date1.getMonth();
  const m2 = date2.getMonth();
  if (m1 !== m2) return m1 < m2;

  return date1.getDate() <= date2.getDate();
}

/**
 * Retorna a data efetiva de vencimento da ocorrência em um determinado mês/ano.
 */
export function getOccurrenceDueDate(
  item: RecurringItem,
  year: number,
  monthIndex: number
): Date {
  const day = getEffectiveDueDay(item, year, monthIndex);
  return createSafeMiddayDate(year, monthIndex, day);
}

/**
 * Formata a data para apresentação no histórico do lançamento
 */
export function formatOccurrenceDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const monthName = MONTH_NAMES_PT[date.getMonth()].slice(0, 3).toLowerCase();
  return `${day} ${monthName}, 12:00`;
}

/**
 * Gera o ID determinístico da transação para garantir idempotência absoluta.
 */
export function getDeterministicOccurrenceId(
  recurringItemId: string,
  periodKey: string
): string {
  return `rec-tx-${recurringItemId}-${periodKey}`;
}

/**
 * Identifica ocorrências de um item recorrente que já venceram até a data `asOfDate`
 * e ainda não foram materializadas como transações reais.
 */
export function getDueOccurrencesForRecurringItem(
  item: RecurringItem,
  cards: CardItem[],
  existingTransactions: ExistingTransactionRef[],
  asOfDate: Date = new Date()
): DueOccurrence[] {
  if (!item.active) return [];

  const startYear = item.startYear ?? asOfDate.getFullYear();
  const startMonth = item.startMonth ?? asOfDate.getMonth();
  const targetEndYear = asOfDate.getFullYear();
  const targetEndMonth = asOfDate.getMonth();

  const occurrences: DueOccurrence[] = [];

  let curYear = startYear;
  let curMonth = startMonth;

  while (
    curYear < targetEndYear ||
    (curYear === targetEndYear && curMonth <= targetEndMonth)
  ) {
    const monthOffset = (curYear - startYear) * 12 + (curMonth - startMonth);

    // Se possui limite de parcelas e já ultrapassou, encerra
    if (
      item.installmentsCount &&
      item.installmentsCount > 0 &&
      monthOffset >= item.installmentsCount
    ) {
      break;
    }

    if (monthOffset >= 0) {
      const periodKey = getPeriodKey(curYear, curMonth);
      const occurrenceId = getDeterministicOccurrenceId(item.id, periodKey);

      // Verificação de Idempotência:
      // 1. Já está na lista de períodos realizados do item recorrente?
      const alreadyInRealizedPeriods = Boolean(
        item.realizedPeriods?.includes(periodKey)
      );

      // 2. Já existe transação gravada com esse ID ou chave de competência?
      const alreadyInTransactions = existingTransactions.some(
        (tx) =>
          tx.id === occurrenceId ||
          (tx.recurringItemId === item.id && tx.periodKey === periodKey)
      );

      if (!alreadyInRealizedPeriods && !alreadyInTransactions) {
        const dueDate = getOccurrenceDueDate(item, curYear, curMonth);

        // Se a data de vencimento já chegou (dueDate <= asOfDate)
        if (isSameOrBeforeCalendarDay(dueDate, asOfDate)) {
          const isCredit = cards.some(
            (c) =>
              c.type === "credit" &&
              (c.id === item.cardId ||
                c.id === item.account ||
                c.name.trim().toLowerCase() === item.account.trim().toLowerCase())
          );

          occurrences.push({
            occurrenceId,
            recurringItemId: item.id,
            periodKey,
            dueDate,
            formattedDate: formatOccurrenceDate(dueDate),
            amount: item.amount,
            type: item.type === "income" ? "in" : "out",
            description: item.title,
            category: item.category,
            paymentMethod: item.account,
            cardId: item.cardId || null,
            isCredit,
          });
        }
      }
    }

    // Avança para o próximo mês
    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  return occurrences;
}

/**
 * Processa todos os itens recorrentes e retorna a lista de ocorrências pendentes
 * e vencidas prontas para materialização.
 */
export function getPendingDueOccurrences(
  recurringItems: RecurringItem[],
  cards: CardItem[],
  existingTransactions: ExistingTransactionRef[],
  asOfDate: Date = new Date()
): DueOccurrence[] {
  const allOccurrences: DueOccurrence[] = [];

  for (const item of recurringItems) {
    const due = getDueOccurrencesForRecurringItem(
      item,
      cards,
      existingTransactions,
      asOfDate
    );
    allOccurrences.push(...due);
  }

  // Ordenar cronologicamente pelo vencimento
  return allOccurrences.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
