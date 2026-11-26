/**
 * "Dá pra pagar?" — linha do tempo do saldo da conta corrente.
 *
 * Parte do saldo de hoje, soma cada entrada prevista no dia em que cai e tira
 * cada conta no dia em que vence (contas no débito/Pix e faturas de cartão no
 * vencimento; compras no cartão só pesam quando a fatura vence). A linha é
 * dividida em trechos entre um recebimento e o próximo, e cada trecho responde
 * se o saldo cobre tudo o que vence nele.
 */
import type { CardItem, GoalItem, RecurringItem } from "../../types/index.ts";
import { getPeriodKey } from "../utils/dateUtils.ts";
import { getBillCoverageForPeriod } from "../utils/goalBills.ts";
import {
  buildFinancialCalendar,
  type FinancialCalendarTransaction,
} from "./financialCalendarService.ts";

const round2 = (value: number) => Math.round(value * 100) / 100;

export interface RunwayEvent {
  id: string;
  date: Date;
  title: string;
  amount: number;
  kind: "income" | "bill" | "invoice";
  /** Venceu antes de hoje e ainda não foi pago: conta como devido hoje. */
  overdue: boolean;
  /** Parte já guardada em metas vinculadas (já abatida de `amount`). */
  coveredByGoals: number;
}

export interface RunwaySegment {
  /** Início do trecho: hoje (1º trecho) ou o dia de um recebimento. */
  startDate: Date;
  /** Próximo recebimento (exclusivo) ou fim do horizonte. */
  endDate: Date;
  /** Recebimentos que abrem o trecho (vazio no trecho que começa hoje). */
  incomes: RunwayEvent[];
  incomeTotal: number;
  /** Saldo antes dos recebimentos do trecho. */
  openingBalance: number;
  bills: RunwayEvent[];
  billsTotal: number;
  closingBalance: number;
  lowestBalance: number;
  lowestDate: Date;
  /** Primeira conta que o saldo não cobre. */
  firstUncovered: { event: RunwayEvent; balanceAfter: number } | null;
  /** Quanto falta para pagar tudo do trecho (0 = dá para pagar). */
  shortfall: number;
}

export interface CashRunway {
  today: Date;
  startBalance: number;
  segments: RunwaySegment[];
  lowestBalance: number;
  lowestDate: Date;
  firstUncovered: { event: RunwayEvent; balanceAfter: number } | null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Junta entradas e contas pendentes de hoje até o fim do horizonte. */
export function collectRunwayEvents(params: {
  cards: CardItem[];
  recurringItems: RecurringItem[];
  transactions: FinancialCalendarTransaction[];
  goals?: GoalItem[];
  today?: Date;
  /** Quantos meses seguintes ao atual entram (1 = até o fim do mês que vem). */
  monthsAhead?: number;
}): RunwayEvent[] {
  const today = startOfDay(params.today ?? new Date());
  const events: RunwayEvent[] = [];
  const monthsAhead = Math.max(0, Math.min(6, params.monthsAhead ?? 1));

  for (let offset = 0; offset <= monthsAhead; offset++) {
    const ref = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    const periodKey = getPeriodKey(year, month);
    const coverage = getBillCoverageForPeriod(params.goals ?? [], params.recurringItems, periodKey);
    const days = buildFinancialCalendar({
      year, month,
      cards: params.cards,
      recurringItems: params.recurringItems,
      transactions: params.transactions,
      now: params.today ?? new Date(),
    });

    days.forEach((day) => {
      const dueDate = new Date(year, month, day.day);
      const overdue = dueDate < today;
      const date = overdue ? today : dueDate;
      for (const bill of day.bills) {
        if (bill.status !== "pending" || !(bill.amount > 0)) continue;
        if (bill.type === "income") {
          events.push({ id: `${bill.id}-${periodKey}`, date, title: bill.title, amount: round2(bill.amount), kind: "income", overdue, coveredByGoals: 0 });
          continue;
        }
        const covered = bill.sourceItem ? Math.min(bill.amount, coverage.get(bill.sourceItem.id)?.covered ?? 0) : 0;
        const amount = round2(bill.amount - covered);
        if (amount <= 0) continue;
        events.push({
          id: `${bill.id}-${periodKey}`,
          date,
          title: bill.title,
          amount,
          kind: bill.type === "credit_invoice" ? "invoice" : "bill",
          overdue,
          coveredByGoals: round2(covered),
        });
      }
    });
  }

  // No mesmo dia, o dinheiro entra antes das contas saírem.
  return events.sort((a, b) =>
    a.date.getTime() - b.date.getTime() ||
    (a.kind === "income" ? 0 : 1) - (b.kind === "income" ? 0 : 1) ||
    b.amount - a.amount
  );
}

/** Divide a linha do tempo em trechos entre recebimentos e testa cada um. */
export function buildCashRunway(params: {
  startBalance: number;
  events: RunwayEvent[];
  today?: Date;
  /** Fim do horizonte (exclusivo). Padrão: dia seguinte ao último evento. */
  horizonEnd?: Date;
}): CashRunway {
  const today = startOfDay(params.today ?? new Date());
  const startBalance = round2(Number.isFinite(params.startBalance) ? params.startBalance : 0);
  const events = params.events.filter((event) => event.date >= today);
  const lastDate = events.length ? events[events.length - 1].date : today;
  const horizonEnd = params.horizonEnd ?? new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate() + 1);

  // Datas que abrem trecho: hoje e cada dia com recebimento.
  const incomeDays = [...new Set(events
    .filter((event) => event.kind === "income" && event.date > today)
    .map((event) => event.date.getTime()))].sort((a, b) => a - b);
  const starts = [today.getTime(), ...incomeDays];

  const segments: RunwaySegment[] = [];
  let balance = startBalance;
  let overallLowest = startBalance;
  let overallLowestDate = today;
  let overallFirst: CashRunway["firstUncovered"] = null;

  starts.forEach((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : horizonEnd.getTime();
    const inSegment = events.filter((event) => event.date.getTime() >= start && event.date.getTime() < end);
    const incomes = inSegment.filter((event) => event.kind === "income" && event.date.getTime() === start);
    const rest = inSegment.filter((event) => !incomes.includes(event));
    const openingBalance = round2(balance);
    const incomeTotal = round2(incomes.reduce((sum, event) => sum + event.amount, 0));
    balance = round2(balance + incomeTotal);

    let lowest = balance;
    let lowestDate = new Date(start);
    let firstUncovered: RunwaySegment["firstUncovered"] = null;
    for (const event of rest) {
      balance = round2(balance + (event.kind === "income" ? event.amount : -event.amount));
      if (balance < lowest) {
        lowest = balance;
        lowestDate = event.date;
      }
      if (!firstUncovered && event.kind !== "income" && balance < 0) {
        firstUncovered = { event, balanceAfter: balance };
      }
    }
    const bills = rest.filter((event) => event.kind !== "income");
    segments.push({
      startDate: new Date(start),
      endDate: new Date(end),
      incomes,
      incomeTotal,
      openingBalance,
      bills,
      billsTotal: round2(bills.reduce((sum, event) => sum + event.amount, 0)),
      closingBalance: balance,
      lowestBalance: lowest,
      lowestDate,
      firstUncovered,
      shortfall: round2(Math.max(0, -lowest)),
    });
    if (lowest < overallLowest) {
      overallLowest = lowest;
      overallLowestDate = lowestDate;
    }
    if (!overallFirst && firstUncovered) overallFirst = firstUncovered;
  });

  return {
    today,
    startBalance,
    segments,
    lowestBalance: overallLowest,
    lowestDate: overallLowestDate,
    firstUncovered: overallFirst,
  };
}
