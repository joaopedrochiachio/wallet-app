/**
 * Raio-X das recorrentes: o que se repete todo mês, quanto custa no ano,
 * quando cada parcelamento termina (alívio) e o que merece atenção.
 * Cálculo local e determinístico: nada aqui chama IA.
 */
import type { CardItem, RecurringItem } from "../../types/index.ts";
import {
  MONTH_NAMES_PT,
  getEffectiveDueDay,
  getEffectiveRecurringItemForPeriod,
  getPeriodKey,
  isRecurringActiveInMonth,
} from "../utils/dateUtils.ts";
import { matchesLedgerCard } from "../utils/ledger.ts";

const round2 = (value: number) => Math.round(value * 100) / 100;
const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLocaleLowerCase("pt-BR");

export interface RadarCost {
  item: RecurringItem;
  kind: "fixed" | "installment";
  accountName: string;
  accountId: string | null;
  isCredit: boolean;
  /** Valor da próxima cobrança. */
  monthly: number;
  /** Soma das cobranças nos próximos 12 meses. */
  nextYear: number;
  /** Parcelamentos: parcelas que ainda vão cair e a última competência. */
  remainingCount?: number;
  lastPeriodKey?: string;
}

export interface RadarRelief {
  periodKey: string;
  label: string;
  /** Quanto deixa de sair por mês a partir desta competência. */
  amount: number;
  items: string[];
}

export type RadarAlert =
  | { kind: "duplicate"; title: string; items: RecurringItem[]; periods: string[]; monthlyWaste: number }
  | { kind: "price_change"; item: RecurringItem; periodKey: string; from: number; to: number }
  | { kind: "before_income"; item: RecurringItem; dueDay: number; incomeDay: number; amount: number };

export interface RecurringRadar {
  costs: RadarCost[];
  fixedMonthly: number;
  installmentsMonthly: number;
  nextYearTotal: number;
  monthlyIncome: number;
  /** Fatia da renda recorrente já comprometida com recorrentes (0–1+). */
  incomeShare: number | null;
  relief: RadarRelief[];
  alerts: RadarAlert[];
}

function periodLabel(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  return `${MONTH_NAMES_PT[month - 1]} ${year}`;
}

function nextPeriods(today: Date, count: number) {
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth(), key: getPeriodKey(date.getFullYear(), date.getMonth()) };
  });
}

export function buildRecurringRadar(params: {
  recurringItems: RecurringItem[];
  cards: CardItem[];
  today?: Date;
}): RecurringRadar {
  const today = params.today ?? new Date();
  const periods = nextPeriods(today, 12);
  const accountOf = (item: RecurringItem) =>
    params.cards.find((card) => matchesLedgerCard(card, item.account, item.cardId));

  const costs: RadarCost[] = [];
  const reliefByPeriod = new Map<string, RadarRelief>();
  const alerts: RadarAlert[] = [];

  // Renda recorrente: média dos próximos 12 meses das entradas planejadas.
  let incomeYear = 0;
  for (const item of params.recurringItems) {
    if (item.type !== "income" || !item.active) continue;
    for (const period of periods) {
      if (isRecurringActiveInMonth({ ...item, realizedPeriods: [] }, period.year, period.month)) {
        incomeYear += getEffectiveRecurringItemForPeriod(item, period.key).amount;
      }
    }
  }
  const monthlyIncome = round2(incomeYear / 12);

  for (const item of params.recurringItems) {
    if (item.type === "income" || !item.active) continue;
    const isInstallment = Boolean(item.installmentsCount && item.installmentsCount > 1);
    // Uma compra única não é recorrente.
    if (item.installmentsCount === 1) continue;
    // Já pago neste mês continua sendo custo do mês: ignora realizedPeriods aqui.
    const schedule = { ...item, realizedPeriods: [] };
    const active = periods.filter((period) => isRecurringActiveInMonth(schedule, period.year, period.month));
    if (active.length === 0) continue;

    const amounts = active.map((period) => ({ key: period.key, amount: getEffectiveRecurringItemForPeriod(item, period.key).amount }));
    const account = accountOf(item);
    const cost: RadarCost = {
      item,
      kind: isInstallment ? "installment" : "fixed",
      accountName: account?.name ?? item.account,
      accountId: account?.id ?? null,
      isCredit: account?.type === "credit",
      monthly: round2(amounts[0].amount),
      nextYear: round2(amounts.reduce((sum, entry) => sum + entry.amount, 0)),
    };

    if (isInstallment) {
      // Parcelas restantes contadas até o fim da série (pode passar de 12 meses).
      let remaining = 0;
      let last = amounts[amounts.length - 1].key;
      for (let offset = 0; offset < 360; offset++) {
        const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        if (isRecurringActiveInMonth(schedule, date.getFullYear(), date.getMonth())) {
          remaining++;
          last = getPeriodKey(date.getFullYear(), date.getMonth());
        } else if (remaining > 0 && offset > 0) break;
      }
      cost.remainingCount = remaining;
      cost.lastPeriodKey = last;
      const [y, m] = last.split("-").map(Number);
      const freeKey = getPeriodKey(new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth());
      const relief = reliefByPeriod.get(freeKey) ?? { periodKey: freeKey, label: periodLabel(freeKey), amount: 0, items: [] };
      relief.amount = round2(relief.amount + getEffectiveRecurringItemForPeriod(item, last).amount);
      relief.items.push(item.title);
      reliefByPeriod.set(freeKey, relief);
    } else {
      // Mudança de valor programada nos próximos meses.
      for (let index = 1; index < amounts.length; index++) {
        if (Math.abs(amounts[index].amount - amounts[index - 1].amount) >= 0.005) {
          alerts.push({ kind: "price_change", item, periodKey: amounts[index].key, from: amounts[index - 1].amount, to: amounts[index].amount });
          break;
        }
      }
    }
    costs.push(cost);
  }

  // Mesma conta ativa em duas séries no mesmo mês (ex.: assinatura em dois cartões).
  const byTitle = new Map<string, RadarCost[]>();
  for (const cost of costs.filter((entry) => entry.kind === "fixed")) {
    const key = normalize(cost.item.title);
    byTitle.set(key, [...(byTitle.get(key) ?? []), cost]);
  }
  for (const group of byTitle.values()) {
    if (group.length < 2) continue;
    const overlap = periods.filter((period) =>
      group.filter((cost) => isRecurringActiveInMonth({ ...cost.item, realizedPeriods: [] }, period.year, period.month)).length > 1
    );
    if (overlap.length === 0) continue;
    alerts.push({
      kind: "duplicate",
      title: group[0].item.title,
      items: group.map((cost) => cost.item),
      periods: overlap.map((period) => period.key),
      monthlyWaste: round2(Math.min(...group.map((cost) => cost.monthly))),
    });
  }

  // Conta no débito que vence antes do primeiro recebimento do mês.
  const nextMonth = periods[1] ?? periods[0];
  const incomeDays = params.recurringItems
    .filter((item) => item.type === "income" && item.active &&
      isRecurringActiveInMonth({ ...item, realizedPeriods: [] }, nextMonth.year, nextMonth.month))
    .map((item) => getEffectiveDueDay(item, nextMonth.year, nextMonth.month));
  if (incomeDays.length > 0) {
    const firstIncome = Math.min(...incomeDays);
    for (const cost of costs) {
      if (cost.isCredit || !isRecurringActiveInMonth({ ...cost.item, realizedPeriods: [] }, nextMonth.year, nextMonth.month)) continue;
      const dueDay = getEffectiveDueDay(cost.item, nextMonth.year, nextMonth.month);
      if (dueDay < firstIncome) {
        alerts.push({
          kind: "before_income",
          item: cost.item,
          dueDay,
          incomeDay: firstIncome,
          amount: round2(getEffectiveRecurringItemForPeriod(cost.item, nextMonth.key).amount),
        });
      }
    }
  }

  const fixedMonthly = round2(costs.filter((cost) => cost.kind === "fixed").reduce((sum, cost) => sum + cost.monthly, 0));
  const installmentsMonthly = round2(costs.filter((cost) => cost.kind === "installment").reduce((sum, cost) => sum + cost.monthly, 0));
  const alertOrder = { duplicate: 0, before_income: 1, price_change: 2 } as const;

  return {
    costs: costs.sort((a, b) => b.nextYear - a.nextYear),
    fixedMonthly,
    installmentsMonthly,
    nextYearTotal: round2(costs.reduce((sum, cost) => sum + cost.nextYear, 0)),
    monthlyIncome,
    incomeShare: monthlyIncome > 0 ? (fixedMonthly + installmentsMonthly) / monthlyIncome : null,
    relief: [...reliefByPeriod.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey)),
    alerts: alerts.sort((a, b) => alertOrder[a.kind] - alertOrder[b.kind]),
  };
}
