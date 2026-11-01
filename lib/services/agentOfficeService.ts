import type { CardItem, GoalItem, RecurringItem } from "../../types/index.ts";
import type { LedgerEntry } from "../utils/ledger.ts";
import { getLedgerEntryDate } from "../utils/ledger.ts";

export interface OfficeCardInvoice {
  cardId: string;
  cardName: string;
  pendingInvoice: number;
  totalInvoice: number;
  dueDay: number;
}

export interface OfficeMonthProjection {
  monthName: string;
  year: number;
  projectedIncome: number;
  totalCommitted: number;
  projectedFreeBalance: number;
  monthNetSurplus: number;
  totalInvoicesPending: number;
  cardInvoices: OfficeCardInvoice[];
}

export interface OfficeTransaction extends LedgerEntry {
  id?: string;
  title?: string;
  category?: string;
  account: string;
}

export interface OfficePattern {
  category: string;
  total: number;
  previousTotal: number;
  changePercent: number;
  count: number;
}

export interface OfficeAnalysis {
  liquidity: {
    series: Array<{ label: string; balance: number; income: number; committed: number }>;
    minimumBalance: number;
    riskMonths: number;
    target: number;
    status: "healthy" | "attention";
  };
  credit: {
    series: Array<{ label: string; amount: number }>;
    totalSixMonths: number;
    averageInvoice: number;
    peakInvoice: number;
    peakMonth: string;
    utilizationPercent: number;
  };
  patterns: {
    categories: OfficePattern[];
    recurringExpense: number;
    variableExpense: number;
    topCategory: string;
    risingCount: number;
  };
  investments: {
    suggestedMonthlyContribution: number;
    projection12Months: number;
    projection24Months: number;
    projection36Months: number;
    annualScenarioRate: number;
    goalsProgress: number;
    totalGoalTarget: number;
    totalGoalSaved: number;
  };
  findings: Array<{
    id: string;
    agentId: "wallet-rubi" | "wallet-sol" | "wallet-nanquim" | "wallet-atlos";
    severity: "positive" | "info" | "warning";
    title: string;
    description: string;
  }>;
}

function roundCurrency(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function futureValueOfContributions(monthlyContribution: number, months: number, monthlyRate: number) {
  if (monthlyContribution <= 0 || months <= 0) return 0;
  if (monthlyRate <= 0) return monthlyContribution * months;
  return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

function getReferenceDate(transactions: OfficeTransaction[], fallback: Date) {
  const dates = transactions
    .map((transaction) => getLedgerEntryDate(transaction))
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return fallback;
  const latest = dates.reduce((max, date) => date.getTime() > max.getTime() ? date : max, dates[0]);
  return latest.getTime() > fallback.getTime() ? latest : fallback;
}

function buildPatterns(transactions: OfficeTransaction[], referenceDate: Date): OfficePattern[] {
  const currentStart = new Date(referenceDate);
  currentStart.setDate(currentStart.getDate() - 29);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 30);
  const current = new Map<string, { total: number; count: number }>();
  const previous = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "despesa") continue;
    if (transaction.kind === "invoice_payment" || transaction.kind === "invoice_settlement") continue;
    const occurredAt = getLedgerEntryDate(transaction);
    if (!occurredAt) continue;
    const category = (transaction.category || "Outros").trim() || "Outros";
    if (occurredAt >= currentStart && occurredAt <= referenceDate) {
      const item = current.get(category) || { total: 0, count: 0 };
      item.total += Math.abs(transaction.amount);
      item.count += 1;
      current.set(category, item);
    } else if (occurredAt >= previousStart && occurredAt < currentStart) {
      previous.set(category, (previous.get(category) || 0) + Math.abs(transaction.amount));
    }
  }

  return [...current.entries()]
    .map(([category, value]) => {
      const previousTotal = previous.get(category) || 0;
      const changePercent = previousTotal > 0
        ? ((value.total - previousTotal) / previousTotal) * 100
        : value.total > 0 ? 100 : 0;
      return {
        category,
        total: roundCurrency(value.total),
        previousTotal: roundCurrency(previousTotal),
        changePercent: Math.round(changePercent),
        count: value.count,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

export function buildAgentOfficeAnalysis(params: {
  cards: CardItem[];
  transactions: OfficeTransaction[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  monthlyProjections: OfficeMonthProjection[];
  targetEndMonthBalance: number;
  referenceDate?: Date;
}): OfficeAnalysis {
  const {
    cards,
    transactions,
    recurringItems,
    goals,
    monthlyProjections,
    targetEndMonthBalance,
  } = params;
  const referenceDate = getReferenceDate(transactions, params.referenceDate || new Date());
  const projectionWindow = monthlyProjections.slice(0, 6);
  const liquiditySeries = projectionWindow.map((projection) => ({
    label: projection.monthName.slice(0, 3),
    balance: roundCurrency(projection.projectedFreeBalance),
    income: roundCurrency(projection.projectedIncome),
    committed: roundCurrency(projection.totalCommitted),
  }));
  const minimumBalance = liquiditySeries.length
    ? Math.min(...liquiditySeries.map((item) => item.balance))
    : 0;
  const riskMonths = liquiditySeries.filter((item) => item.balance < targetEndMonthBalance).length;

  const creditSeries = projectionWindow.map((projection) => ({
    label: projection.monthName.slice(0, 3),
    amount: roundCurrency(
      projection.totalInvoicesPending ||
      projection.cardInvoices.reduce((sum, invoice) => sum + (invoice.pendingInvoice || 0), 0)
    ),
  }));
  const totalSixMonths = creditSeries.reduce((sum, item) => sum + item.amount, 0);
  const peakCredit = creditSeries.reduce(
    (peak, item) => item.amount > peak.amount ? item : peak,
    creditSeries[0] || { label: "—", amount: 0 }
  );
  const totalCreditLimit = cards
    .filter((card) => card.type === "credit")
    .reduce((sum, card) => sum + Math.max(0, card.limit || 0), 0);
  const currentCredit = creditSeries[0]?.amount || 0;

  const categories = buildPatterns(transactions, referenceDate);
  const recurringExpense = recurringItems
    .filter((item) => item.active && item.type !== "income")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const variableExpense = categories.reduce((sum, item) => sum + item.total, 0);

  const contributionCandidates = projectionWindow.map((projection) =>
    Math.max(
      0,
      Math.min(
        Math.max(0, projection.monthNetSurplus),
        Math.max(0, projection.projectedFreeBalance - targetEndMonthBalance)
      )
    )
  );
  const suggestedMonthlyContribution = contributionCandidates.length
    ? roundCurrency(contributionCandidates.reduce((sum, value) => sum + value, 0) / contributionCandidates.length)
    : 0;
  const annualScenarioRate = 10;
  const monthlyScenarioRate = Math.pow(1 + annualScenarioRate / 100, 1 / 12) - 1;
  const totalGoalTarget = goals.reduce((sum, goal) => sum + Math.max(0, goal.target), 0);
  const totalGoalSaved = goals.reduce((sum, goal) => sum + Math.max(0, goal.current), 0);
  const goalsProgress = totalGoalTarget > 0 ? Math.min(100, Math.round((totalGoalSaved / totalGoalTarget) * 100)) : 0;

  const topPattern = categories[0];
  const risingCount = categories.filter((pattern) => pattern.changePercent >= 15).length;
  const findings: OfficeAnalysis["findings"] = [
    {
      id: "liquidity",
      agentId: "wallet-rubi",
      severity: riskMonths > 0 ? "warning" : "positive",
      title: riskMonths > 0 ? `${riskMonths} mês(es) abaixo da meta` : "Caixa protegido nos próximos meses",
      description: riskMonths > 0
        ? `O menor saldo projetado é R$ ${roundCurrency(minimumBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
        : `O piso projetado permanece em R$ ${roundCurrency(minimumBalance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    },
    {
      id: "credit",
      agentId: "wallet-nanquim",
      severity: totalCreditLimit > 0 && currentCredit / totalCreditLimit > 0.5 ? "warning" : "info",
      title: `Pico de fatura em ${peakCredit.label}`,
      description: `R$ ${roundCurrency(peakCredit.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} previstos no mês de maior pressão do crédito.`,
    },
    {
      id: "patterns",
      agentId: "wallet-sol",
      severity: risingCount > 0 ? "warning" : "info",
      title: topPattern ? `${topPattern.category} lidera os últimos 30 dias` : "Base de hábitos em formação",
      description: topPattern
        ? `R$ ${topPattern.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${topPattern.count} lançamento(s).`
        : "Adicione mais lançamentos para melhorar a leitura comportamental.",
    },
    {
      id: "investments",
      agentId: "wallet-atlos",
      severity: suggestedMonthlyContribution > 0 ? "positive" : "warning",
      title: suggestedMonthlyContribution > 0 ? "Capacidade de aporte detectada" : "Sem margem recorrente para aporte",
      description: suggestedMonthlyContribution > 0
        ? `Cenário-base de R$ ${suggestedMonthlyContribution.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por mês.`
        : "A prioridade atual é recuperar a margem de caixa antes de investir.",
    },
  ];

  return {
    liquidity: {
      series: liquiditySeries,
      minimumBalance: roundCurrency(minimumBalance),
      riskMonths,
      target: targetEndMonthBalance,
      status: riskMonths > 0 ? "attention" : "healthy",
    },
    credit: {
      series: creditSeries,
      totalSixMonths: roundCurrency(totalSixMonths),
      averageInvoice: roundCurrency(creditSeries.length ? totalSixMonths / creditSeries.length : 0),
      peakInvoice: roundCurrency(peakCredit.amount),
      peakMonth: peakCredit.label,
      utilizationPercent: totalCreditLimit > 0 ? Math.round((currentCredit / totalCreditLimit) * 100) : 0,
    },
    patterns: {
      categories,
      recurringExpense: roundCurrency(recurringExpense),
      variableExpense: roundCurrency(variableExpense),
      topCategory: topPattern?.category || "Sem dados",
      risingCount,
    },
    investments: {
      suggestedMonthlyContribution,
      projection12Months: roundCurrency(futureValueOfContributions(suggestedMonthlyContribution, 12, monthlyScenarioRate)),
      projection24Months: roundCurrency(futureValueOfContributions(suggestedMonthlyContribution, 24, monthlyScenarioRate)),
      projection36Months: roundCurrency(futureValueOfContributions(suggestedMonthlyContribution, 36, monthlyScenarioRate)),
      annualScenarioRate,
      goalsProgress,
      totalGoalTarget: roundCurrency(totalGoalTarget),
      totalGoalSaved: roundCurrency(totalGoalSaved),
    },
    findings,
  };
}
