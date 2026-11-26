/**
 * Metas vinculadas a uma conta futura do planejamento.
 *
 * Uma meta pode reservar dinheiro para uma ocorrência específica de uma conta
 * planejada (ex.: IPVA de janeiro). O valor guardado na meta abate dessa conta
 * no planejamento: conta de R$ 1.500 com R$ 150 guardados → faltam R$ 1.350
 * saindo do saldo da conta corrente naquele mês.
 */
import type { GoalBillLink, GoalItem, RecurringItem } from "../../types/index.ts";
import {
  MONTH_NAMES_PT,
  getEffectiveRecurringItemForPeriod,
  getPeriodKey,
  isRecurringActiveInMonth,
} from "./dateUtils.ts";

const round2 = (value: number) => Math.round(value * 100) / 100;

function parsePeriodKey(periodKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey);
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null;
}

export function formatBillPeriod(periodKey: string): string {
  const parsed = parsePeriodKey(periodKey);
  if (!parsed) return periodKey;
  return `${MONTH_NAMES_PT[parsed.month]} ${parsed.year}`;
}

export function isValidGoalBillLink(link: unknown): link is GoalBillLink {
  if (!link || typeof link !== "object") return false;
  const { recurringItemId, periodKey } = link as Record<string, unknown>;
  return typeof recurringItemId === "string" && /^[^/]{1,200}$/.test(recurringItemId) &&
    typeof periodKey === "string" && parsePeriodKey(periodKey) !== null;
}

/** A ocorrência ainda vai acontecer (não foi paga, removida nem encerrada). */
export function isBillOccurrencePending(item: RecurringItem, periodKey: string): boolean {
  const parsed = parsePeriodKey(periodKey);
  if (!parsed) return false;
  return isRecurringActiveInMonth(item, parsed.year, parsed.month);
}

export type GoalBillState = "pending" | "paid" | "missing";

export interface GoalBillStatus {
  link: GoalBillLink;
  item: RecurringItem | null;
  title: string;
  periodLabel: string;
  /** Valor da conta naquela competência. */
  amount: number;
  /** Quanto desta meta abate a conta (limitado ao que a conta ainda precisa). */
  covered: number;
  /** Quanto ainda sai da conta corrente depois de abater todas as metas vinculadas. */
  remaining: number;
  state: GoalBillState;
}

export interface BillCoverage {
  recurringItemId: string;
  periodKey: string;
  amount: number;
  covered: number;
  remaining: number;
  goals: { goal: GoalItem; covered: number }[];
}

/**
 * Cobertura das contas pendentes de uma competência. Várias metas podem
 * apontar para a mesma conta; a soma nunca passa do valor da conta.
 */
export function getBillCoverageForPeriod(
  goals: GoalItem[],
  recurringItems: RecurringItem[],
  periodKey: string
): Map<string, BillCoverage> {
  const result = new Map<string, BillCoverage>();
  const itemsById = new Map(recurringItems.map((item) => [item.id, item]));
  for (const goal of goals) {
    const link = goal.linkedBill;
    if (!isValidGoalBillLink(link) || link.periodKey !== periodKey) continue;
    const item = itemsById.get(link.recurringItemId);
    if (!item || item.type === "income" || !isBillOccurrencePending(item, periodKey)) continue;
    const saved = Number.isFinite(goal.current) ? Math.max(0, goal.current) : 0;
    if (saved <= 0) continue;
    const coverage = result.get(item.id) ?? {
      recurringItemId: item.id,
      periodKey,
      amount: round2(getEffectiveRecurringItemForPeriod(item, periodKey).amount),
      covered: 0,
      remaining: 0,
      goals: [],
    };
    const take = round2(Math.min(saved, Math.max(0, coverage.amount - coverage.covered)));
    if (take <= 0) continue;
    coverage.covered = round2(coverage.covered + take);
    coverage.goals.push({ goal, covered: take });
    result.set(item.id, coverage);
  }
  for (const coverage of result.values()) {
    coverage.remaining = round2(Math.max(0, coverage.amount - coverage.covered));
  }
  return result;
}

/** Situação da conta vinculada a uma meta, para mostrar no cartão da meta. */
export function getGoalBillStatus(
  goal: GoalItem,
  goals: GoalItem[],
  recurringItems: RecurringItem[]
): GoalBillStatus | null {
  const link = goal.linkedBill;
  if (!isValidGoalBillLink(link)) return null;
  const item = recurringItems.find((candidate) => candidate.id === link.recurringItemId) ?? null;
  const periodLabel = formatBillPeriod(link.periodKey);
  if (!item) {
    return { link, item: null, title: "Conta removida", periodLabel, amount: 0, covered: 0, remaining: 0, state: "missing" };
  }
  const effective = getEffectiveRecurringItemForPeriod(item, link.periodKey);
  const amount = round2(effective.amount);
  if (!isBillOccurrencePending(item, link.periodKey)) {
    const paid = Boolean(item.realizedPeriods?.includes(link.periodKey));
    return {
      link, item, title: effective.title, periodLabel, amount, covered: 0, remaining: 0,
      state: paid ? "paid" : "missing",
    };
  }
  const coverage = getBillCoverageForPeriod(goals, recurringItems, link.periodKey).get(item.id);
  return {
    link,
    item,
    title: effective.title,
    periodLabel,
    amount,
    covered: coverage?.goals.find((entry) => entry.goal.id === goal.id)?.covered ?? 0,
    remaining: coverage ? coverage.remaining : amount,
    state: "pending",
  };
}

export interface LinkableBillOccurrence {
  periodKey: string;
  periodLabel: string;
  amount: number;
}

export interface LinkableBill {
  item: RecurringItem;
  occurrences: LinkableBillOccurrence[];
}

/**
 * Contas planejadas que ainda vão acontecer e podem receber uma meta,
 * a partir do mês de `today`, em ordem de vencimento.
 */
export function listLinkableBills(
  recurringItems: RecurringItem[],
  isEligible: (item: RecurringItem) => boolean,
  today: Date = new Date(),
  horizonMonths = 24
): LinkableBill[] {
  const bills: LinkableBill[] = [];
  for (const item of recurringItems) {
    if (item.type === "income" || !item.active || !isEligible(item)) continue;
    const occurrences: LinkableBillOccurrence[] = [];
    for (let offset = 0; offset < horizonMonths; offset++) {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const periodKey = getPeriodKey(date.getFullYear(), date.getMonth());
      if (!isBillOccurrencePending(item, periodKey)) continue;
      occurrences.push({
        periodKey,
        periodLabel: formatBillPeriod(periodKey),
        amount: round2(getEffectiveRecurringItemForPeriod(item, periodKey).amount),
      });
    }
    if (occurrences.length > 0) bills.push({ item, occurrences });
  }
  return bills.sort((a, b) => a.occurrences[0].periodKey.localeCompare(b.occurrences[0].periodKey) ||
    a.item.title.localeCompare(b.item.title, "pt-BR"));
}

/** Identificador estável do uso da meta para pagar a conta (evita resgatar duas vezes). */
export function goalBillOperationId(goalId: string, link: GoalBillLink, cents: number): string {
  return `bill-${cents}-${link.periodKey}-${goalId}-${link.recurringItemId}`
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 120);
}
