/**
 * Simulador "E se…?": aplica movimentos hipotéticos sobre a linha do tempo do
 * saldo (cashRunway) sem gravar nada.
 *
 * - Guardar / gastar no débito: o dinheiro sai da conta na data.
 * - Receber extra: o dinheiro entra na data.
 * - Compra no cartão: ocupa o limite inteiro na hora; cada parcela entra na
 *   fatura do ciclo da cobrança e só sai da conta no vencimento dessa fatura.
 */
import type { CardItem } from "../../types/index.ts";
import { getInvoiceCycle, type CardStatement } from "../utils/creditCardEngine.ts";
import { getPeriodKey } from "../utils/dateUtils.ts";
import { getInvoiceDueDate, splitInstallmentPurchase } from "../utils/ledger.ts";
import { buildCashRunway, type CashRunway, type RunwayEvent } from "./cashRunway.ts";

const round2 = (value: number) => Math.round(value * 100) / 100;

export type ScenarioMove =
  | { id: string; kind: "save"; amount: number; date: Date; label?: string }
  | { id: string; kind: "debit"; amount: number; date: Date; label?: string }
  | { id: string; kind: "income"; amount: number; date: Date; label?: string }
  | { id: string; kind: "card"; amount: number; date: Date; cardId: string; installments: number; label?: string };

export const MOVE_LABEL: Record<ScenarioMove["kind"], string> = {
  save: "Guardar",
  debit: "Gasto no débito/Pix",
  income: "Receber extra",
  card: "Compra no cartão",
};

export interface CardMoveImpact {
  moveId: string;
  card: CardItem;
  availableBefore: number;
  availableAfter: number;
  /** Compra maior que o limite disponível: o banco recusaria. */
  exceedsLimit: boolean;
  installments: { invoiceKey: string; dueDate: Date; amount: number }[];
}

export interface ScenarioResult {
  base: CashRunway;
  simulated: CashRunway;
  extraEvents: RunwayEvent[];
  cardImpacts: CardMoveImpact[];
  /** Saldo no fim de cada dia, de hoje até o fim do horizonte. */
  daily: { date: Date; base: number; simulated: number }[];
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last), 12);
}

/** Converte os movimentos em entradas/saídas da conta corrente. */
export function scenarioEvents(
  moves: ScenarioMove[],
  cards: CardItem[],
  statements: Record<string, CardStatement | undefined>
): { events: RunwayEvent[]; cardImpacts: CardMoveImpact[] } {
  const events: RunwayEvent[] = [];
  const cardImpacts: CardMoveImpact[] = [];
  // Várias compras no mesmo cartão disputam o mesmo limite.
  const usedBySimulation = new Map<string, number>();

  for (const move of moves) {
    const amount = round2(move.amount);
    if (!(amount > 0) || Number.isNaN(move.date.getTime())) continue;
    const date = startOfDay(move.date);
    const title = move.label?.trim() || MOVE_LABEL[move.kind];

    if (move.kind !== "card") {
      events.push({
        id: `sim-${move.id}`,
        date,
        title,
        amount,
        kind: move.kind === "income" ? "income" : "bill",
        overdue: false,
        coveredByGoals: 0,
      });
      continue;
    }

    const card = cards.find((candidate) => candidate.id === move.cardId && candidate.type === "credit");
    if (!card) continue;
    const statement = statements[card.id];
    const alreadySimulated = usedBySimulation.get(card.id) ?? 0;
    const availableBefore = round2((statement?.availableLimit ?? card.limit ?? 0) - alreadySimulated);
    usedBySimulation.set(card.id, alreadySimulated + amount);

    const count = Math.max(1, Math.min(48, Math.round(move.installments || 1)));
    const split = splitInstallmentPurchase(amount, count);
    const installments: CardMoveImpact["installments"] = [];
    for (let index = 0; index < count; index++) {
      const chargeDate = addMonthsClamped(date, index);
      const due = getInvoiceDueDate(card, chargeDate);
      const invoiceKey = getPeriodKey(due.getFullYear(), due.getMonth());
      const installmentAmount = index === count - 1 ? split.lastInstallmentAmount : split.installmentAmount;
      const dueDate = startOfDay(getInvoiceCycle(card, invoiceKey).dueDate);
      installments.push({ invoiceKey, dueDate, amount: installmentAmount });
      events.push({
        id: `sim-${move.id}-${index}`,
        date: dueDate,
        title: `Fatura ${card.name} · ${title}${count > 1 ? ` ${index + 1}/${count}` : ""}`,
        amount: installmentAmount,
        kind: "invoice",
        overdue: false,
        coveredByGoals: 0,
      });
    }
    cardImpacts.push({
      moveId: move.id,
      card,
      availableBefore,
      availableAfter: round2(availableBefore - amount),
      exceedsLimit: amount > availableBefore + 0.005,
      installments,
    });
  }

  return { events, cardImpacts };
}

function dailyBalances(startBalance: number, events: RunwayEvent[], today: Date, end: Date) {
  const byDay = new Map<number, number>();
  for (const event of events) {
    const key = startOfDay(event.date).getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + (event.kind === "income" ? event.amount : -event.amount));
  }
  const series: { date: Date; balance: number }[] = [];
  let balance = startBalance;
  for (let day = startOfDay(today); day < end; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    balance = round2(balance + (byDay.get(day.getTime()) ?? 0));
    series.push({ date: day, balance });
  }
  return series;
}

export function simulateScenario(params: {
  startBalance: number;
  baseEvents: RunwayEvent[];
  moves: ScenarioMove[];
  cards: CardItem[];
  statements: Record<string, CardStatement | undefined>;
  today?: Date;
  horizonEnd: Date;
}): ScenarioResult {
  const today = startOfDay(params.today ?? new Date());
  const { events: extraEvents, cardImpacts } = scenarioEvents(params.moves, params.cards, params.statements);
  // O horizonte cresce se alguma parcela simulada vencer depois dele.
  const lastExtra = extraEvents.reduce((max, event) => Math.max(max, event.date.getTime()), 0);
  const horizonEnd = lastExtra >= params.horizonEnd.getTime()
    ? new Date(new Date(lastExtra).getFullYear(), new Date(lastExtra).getMonth() + 1, 1)
    : params.horizonEnd;

  const sorted = (events: RunwayEvent[]) => [...events].sort((a, b) =>
    a.date.getTime() - b.date.getTime() || (a.kind === "income" ? 0 : 1) - (b.kind === "income" ? 0 : 1));
  const baseEvents = sorted(params.baseEvents);
  const simEvents = sorted([...params.baseEvents, ...extraEvents]);

  const base = buildCashRunway({ startBalance: params.startBalance, events: baseEvents, today, horizonEnd });
  const simulated = buildCashRunway({ startBalance: params.startBalance, events: simEvents, today, horizonEnd });
  const baseDaily = dailyBalances(params.startBalance, baseEvents, today, horizonEnd);
  const simDaily = dailyBalances(params.startBalance, simEvents, today, horizonEnd);

  return {
    base,
    simulated,
    extraEvents,
    cardImpacts,
    daily: baseDaily.map((point, index) => ({ date: point.date, base: point.balance, simulated: simDaily[index].balance })),
  };
}
