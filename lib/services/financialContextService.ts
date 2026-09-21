/**
 * Sintetizador de Contexto Financeiro para o Analista de IA
 * Transforma dados do usuário, cartões, despesas e metas em telemetria estruturada.
 */

import type {
  UserProfile,
  CardItem,
  GoalItem,
  RecurringItem,
  FinancialPersonaId,
  RiskToleranceId,
  AIToneId,
} from "../../types/index.ts";
import { isCommonCommercialTerm, redactPersonalData } from "./privacyService.ts";

export interface TransactionContextItem {
  id: string;
  title: string;
  amount: number;
  type: "despesa" | "receita";
  category: string;
  account: string;
  cardId?: string | null;
  date: string;
  occurredAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  kind?: "regular" | "invoice_payment" | "invoice_settlement";
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

export interface SpecificSpendItem {
  title: string;
  total: number;
  count: number;
  category: string;
  percentage: number;
}

export interface LiquidityAnalysis {
  currentMonth: {
    monthName: string;
    checkingBalance: number;
    pendingBills: number;
    projectedFreeBalance: number;
  };
  nextMonth: {
    monthName: string;
    projectedIncome: number;
    committedExpenses: number;
    cardInstallments: number;
    recurringDebit: number;
    recurringCredit: number;
    projectedFreeBalance: number;
  };
}

export interface FinancialTelemetry {
  user: {
    name: string;
    monthlyIncomeBase: number;
    persona: FinancialPersonaId;
    riskTolerance: RiskToleranceId;
    aiTone: AIToneId;
    primaryFocus: string;
    maxCommitmentAlertPercent: number;
  };
  cashflow: {
    checkingBalance: number;
    monthIncomeRealized: number;
    monthExpenseRealized: number;
    netCashflow: number;
    savingsRatePercent: number;
  };
  credit: {
    totalLimit: number;
    totalSpent: number;
    availableCredit: number;
    creditUtilizationPercent: number;
    cardsCount: number;
    cardsSummary: Array<{
      name: string;
      brand: string;
      limit: number;
      spent: number;
      available: number;
      closingDay?: number;
      dueDay?: number;
    }>;
  };
  commitments: {
    recurringMonthlyTotal: number;
    recurringCount: number;
    commitmentRatioPercent: number;
    isOverLimit: boolean;
    recurringItems: Array<{
      title: string;
      amount: number;
      category: string;
      dueDay: number;
      account: string;
    }>;
  };
  categories: CategorySummary[];
  goals: Array<{
    title: string;
    category: string;
    current: number;
    target: number;
    gap: number;
    progressPercent: number;
    deadline?: string;
  }>;
  monthlyProjections?: MonthProjectionSummary[];
  topSpendItems?: SpecificSpendItem[];
  recentExpenses?: Array<{ title: string; amount: number; date: string; category: string }>;
  liquidityAnalysis?: LiquidityAnalysis;
}

export interface MonthProjectionSummary {
  monthName: string;
  year: number;
  openingBalance: number;
  plannedIncomesTotal: number;
  recurringDebitTotal: number;
  recurringCreditTotal: number;
  cardInstallments: number;
  totalCommitted: number;
  projectedFreeBalance: number;
}

export interface FinancialTelemetryInput {
  userProfile?: UserProfile | null;
  cards: CardItem[];
  transactions: TransactionContextItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  mainBalance: number;
  monthIncome: number;
  monthExpense: number;
  monthlyProjections?: MonthProjectionSummary[];
}

export const SAFE_FINANCIAL_CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Dívidas",
  "Investimentos",
  "Renda",
  "Outros",
] as const;

export type SafeFinancialCategory = (typeof SAFE_FINANCIAL_CATEGORIES)[number];
export type SafePaymentMethod = "Conta corrente" | `Cartão ${number}` | "Outro meio";

export interface SafeFinancialContext {
  profile: {
    monthlyIncomeBase: number;
    persona: FinancialPersonaId;
    riskTolerance: RiskToleranceId;
    aiTone: AIToneId;
    maxCommitmentAlertPercent: number;
  };
  cashflow: FinancialTelemetry["cashflow"];
  credit: {
    totalLimit: number;
    totalSpent: number;
    availableCredit: number;
    creditUtilizationPercent: number;
    cardsCount: number;
    cardsSummary: Array<{
      alias: `Cartão ${number}`;
      limit: number;
      spent: number;
      available: number;
      closingDay?: number;
      dueDay?: number;
    }>;
  };
  commitments: {
    recurringMonthlyTotal: number;
    recurringCount: number;
    commitmentRatioPercent: number;
    isOverLimit: boolean;
    recurringItems: Array<{
      category: SafeFinancialCategory;
      amount: number;
      dueDay: number;
      paymentMethod: SafePaymentMethod;
      active: true;
    }>;
  };
  categories: Array<{
    category: SafeFinancialCategory;
    total: number;
    count: number;
    percentage: number;
  }>;
  goals: Array<{
    alias: `Meta ${number}`;
    current: number;
    target: number;
    gap: number;
    progressPercent: number;
    deadline?: string;
  }>;
  monthlyProjections: MonthProjectionSummary[];
  topSpendItems: SpecificSpendItem[];
  recentExpenses: Array<{ title: string; amount: number; date: string; category: string }>;
  liquidityAnalysis: LiquidityAnalysis;
}

export interface PurchaseSimulationInput {
  amount: number;
  method: "cash" | "credit";
  installments?: number;
  cardId?: string;
  description?: string;
}

export interface PurchaseSimulationResult {
  amount: number;
  method: "cash" | "credit";
  installments: number;
  monthlyInstallmentAmount: number;
  cardName?: string;
  before: {
    checkingBalance: number;
    cardInvoice?: number;
    cardAvailableLimit?: number;
    monthlyCommitmentPercent: number;
  };
  after: {
    checkingBalance: number;
    cardInvoice?: number;
    cardAvailableLimit?: number;
    monthlyCommitmentPercent: number;
  };
  verdict: "safe" | "warning" | "critical";
  verdictMessage: string;
  impactSummary: string;
}

/**
 * Constrói o objeto de telemetria financeira a partir do estado atual da aplicação
 */
export function synthesizeFinancialTelemetry(data: FinancialTelemetryInput): FinancialTelemetry {
  const {
    userProfile,
    cards,
    transactions,
    recurringItems,
    goals,
    mainBalance,
    monthIncome,
    monthExpense,
  } = data;

  const monthlyIncomeBase = userProfile?.monthlyIncomeBase || (monthIncome > 0 ? monthIncome : 5000);
  const persona: FinancialPersonaId = userProfile?.persona || "optimizer";
  const riskTolerance: RiskToleranceId = userProfile?.riskTolerance || "moderate";
  const aiTone: AIToneId = userProfile?.aiTone || "analytical";
  const primaryFocus = userProfile?.primaryFocus || "Equilíbrio financeiro e metas";
  const maxCommitmentAlertPercent = userProfile?.maxCommitmentAlertPercent || 60;

  // Cartões de Crédito
  const creditCards = cards.filter((c) => c.type === "credit");
  const totalLimit = creditCards.reduce((acc, c) => acc + (c.limit || 0), 0);
  const totalSpent = creditCards.reduce((acc, c) => acc + (c.spent || c.invoiceAmount || 0), 0);
  const availableCredit = Math.max(0, totalLimit - totalSpent);
  const creditUtilizationPercent =
    totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  const cardsSummary = creditCards.map((c) => ({
    name: c.name,
    brand: c.brand,
    limit: c.limit,
    spent: c.spent || c.invoiceAmount || 0,
    available: Math.max(0, c.limit - (c.spent || c.invoiceAmount || 0)),
    closingDay: c.closingDay,
    dueDay: c.dueDay,
  }));

  // Recorrências e Comprometimento Fixo
  const activeRecurring = recurringItems.filter((r) => r.active !== false);
  const recurringMonthlyTotal = activeRecurring.reduce((acc, r) => acc + (r.amount || 0), 0);
  const commitmentRatioPercent =
    monthlyIncomeBase > 0
      ? Math.round(((recurringMonthlyTotal + totalSpent) / monthlyIncomeBase) * 100)
      : 0;

  const isOverLimit = commitmentRatioPercent > maxCommitmentAlertPercent;

  // Lançamentos agrupados por categoria
  const expenseTransactions = transactions.filter((t) => t.type === "despesa");
  const totalExpenses = expenseTransactions.reduce((acc, t) => acc + t.amount, 0);

  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const t of expenseTransactions) {
    const cat = t.category || "Outros";
    const current = categoryMap.get(cat) || { total: 0, count: 0 };
    categoryMap.set(cat, {
      total: current.total + t.amount,
      count: current.count + 1,
    });
  }

  const categories: CategorySummary[] = Array.from(categoryMap.entries())
    .map(([category, info]) => ({
      category,
      total: info.total,
      count: info.count,
      percentage: totalExpenses > 0 ? Math.round((info.total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Agrupamento por item/estabelecimento específico de despesa (ex: iFood, Uber, etc.)
  const nonSettlementExpenses = expenseTransactions.filter(
    (t) => t.kind !== "invoice_payment" && t.kind !== "invoice_settlement"
  );
  const spendMap = new Map<string, { title: string; total: number; count: number; category: string }>();
  for (const t of nonSettlementExpenses) {
    const rawTitle = t.title?.trim() || "Outras despesas";
    const key = rawTitle.toLowerCase();
    const existing = spendMap.get(key);
    if (existing) {
      existing.total += t.amount;
      existing.count += 1;
    } else {
      spendMap.set(key, {
        title: rawTitle,
        total: t.amount,
        count: 1,
        category: t.category || "Outros",
      });
    }
  }

  const topSpendItems: SpecificSpendItem[] = Array.from(spendMap.values())
    .map((item) => ({
      title: item.title,
      total: item.total,
      count: item.count,
      category: item.category,
      percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const recentExpenses = [...nonSettlementExpenses]
    .sort((a, b) => {
      const dateA = a.occurredAt ? new Date(a.occurredAt).getTime() : new Date(a.date).getTime();
      const dateB = b.occurredAt ? new Date(b.occurredAt).getTime() : new Date(b.date).getTime();
      return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    })
    .slice(0, 12)
    .map((t) => ({
      title: t.title || "Despesa",
      amount: t.amount,
      date: typeof t.date === "string" ? t.date : new Date(t.date).toLocaleDateString("pt-BR"),
      category: t.category || "Outros",
    }));

  // Análise de Liquidez: Mês Atual vs Mês Que Vem
  const projections = data.monthlyProjections || [];
  const currentProj = projections[0];
  const nextProj = projections[1];

  const currentCheckingBalance = mainBalance;
  const currentPendingBills = currentProj ? currentProj.totalCommitted : monthExpense;
  const currentProjectedFree = currentProj ? currentProj.projectedFreeBalance : Math.max(0, mainBalance - monthExpense);

  const nextIncome = nextProj?.plannedIncomesTotal || (userProfile?.monthlyIncomeBase || monthIncome) || 0;
  const nextCommitted = nextProj?.totalCommitted || 0;
  const nextCardInstallments = nextProj?.cardInstallments || 0;
  const nextRecurringDebit = nextProj?.recurringDebitTotal || 0;
  const nextRecurringCredit = nextProj?.recurringCreditTotal || 0;
  const nextProjectedFree = nextProj?.projectedFreeBalance ?? Math.max(0, nextIncome - nextCommitted);

  const liquidityAnalysis: LiquidityAnalysis = {
    currentMonth: {
      monthName: currentProj?.monthName || "Mês Atual",
      checkingBalance: currentCheckingBalance,
      pendingBills: currentPendingBills,
      projectedFreeBalance: currentProjectedFree,
    },
    nextMonth: {
      monthName: nextProj?.monthName || "Próximo Mês",
      projectedIncome: nextIncome,
      committedExpenses: nextCommitted,
      cardInstallments: nextCardInstallments,
      recurringDebit: nextRecurringDebit,
      recurringCredit: nextRecurringCredit,
      projectedFreeBalance: nextProjectedFree,
    },
  };

  // Metas
  const goalsSummary = goals.map((g) => {
    const progressPercent = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return {
      title: g.title,
      category: g.category,
      current: g.current,
      target: g.target,
      gap: Math.max(0, g.target - g.current),
      progressPercent,
      deadline: g.deadline,
    };
  });

  const netCashflow = monthIncome - monthExpense;
  const savingsRatePercent =
    monthIncome > 0 ? Math.round((Math.max(0, netCashflow) / monthIncome) * 100) : 0;

  return {
    user: {
      name: userProfile?.name || "Usuário",
      monthlyIncomeBase,
      persona,
      riskTolerance,
      aiTone,
      primaryFocus,
      maxCommitmentAlertPercent,
    },
    cashflow: {
      checkingBalance: mainBalance,
      monthIncomeRealized: monthIncome,
      monthExpenseRealized: monthExpense,
      netCashflow,
      savingsRatePercent,
    },
    credit: {
      totalLimit,
      totalSpent,
      availableCredit,
      creditUtilizationPercent,
      cardsCount: creditCards.length,
      cardsSummary,
    },
    commitments: {
      recurringMonthlyTotal,
      recurringCount: activeRecurring.length,
      commitmentRatioPercent,
      isOverLimit,
      recurringItems: activeRecurring.slice(0, 10).map((r) => ({
        title: r.title,
        amount: r.amount,
        category: r.category,
        dueDay: r.dueDay,
        account: r.account,
      })),
    },
    categories,
    goals: goalsSummary,
    monthlyProjections: data.monthlyProjections || [],
    topSpendItems,
    recentExpenses,
    liquidityAnalysis,
  };
}

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function normalizeFinancialCategory(category: string): SafeFinancialCategory {
  const normalized = normalizeForComparison(category);

  if (/aliment|supermercado|delivery|restaurante/.test(normalized)) return "Alimentação";
  if (/moradia|aluguel|condominio|contas?\b|energia|eletric|agua/.test(normalized)) return "Moradia";
  if (/transport|combust|mobilidade|uber|taxi/.test(normalized)) return "Transporte";
  if (/saude|farmacia|medic|bem-estar/.test(normalized)) return "Saúde";
  if (/educa|curso|escola|faculdade/.test(normalized)) return "Educação";
  if (/assinatura|streaming|mensalidade/.test(normalized)) return "Assinaturas";
  if (/lazer|turismo|viagem|cinema|entretenimento/.test(normalized)) return "Lazer";
  if (/divida|emprestimo|financiamento|fatura/.test(normalized)) return "Dívidas";
  if (/invest|rendimento|dividendo|aplicacao/.test(normalized)) return "Investimentos";
  if (/renda|salario|pro-labore|freelance|bonus|receita|reembolso|cashback/.test(normalized)) {
    return "Renda";
  }

  return "Outros";
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeDeadline(deadline?: unknown): string | undefined {
  if (typeof deadline !== "string") return undefined;
  const trimmed = deadline.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

/**
 * Produz o único formato de contexto autorizado a compor prompts enviados à IA.
 * Identificadores e textos livres permanecem apenas na telemetria interna.
 */
export function createSafeFinancialContext(telemetry: FinancialTelemetry): SafeFinancialContext {
  const persona: FinancialPersonaId = ["optimizer", "guardian", "scaler", "minimalist"].includes(
    telemetry.user.persona
  )
    ? telemetry.user.persona
    : "optimizer";
  const riskTolerance: RiskToleranceId = ["low", "moderate", "high"].includes(
    telemetry.user.riskTolerance
  )
    ? telemetry.user.riskTolerance
    : "moderate";
  const aiTone: AIToneId = ["analytical", "direct", "collaborative"].includes(
    telemetry.user.aiTone
  )
    ? telemetry.user.aiTone
    : "analytical";
  const cardAliases = new Map<string, `Cartão ${number}`>();
  const cardsSummary = telemetry.credit.cardsSummary.map((card, index) => {
    const alias = `Cartão ${index + 1}` as const;
    cardAliases.set(normalizeForComparison(String(card.name ?? "")), alias);
    return {
      alias,
      limit: safeNumber(card.limit),
      spent: safeNumber(card.spent),
      available: safeNumber(card.available),
      closingDay: safeOptionalNumber(card.closingDay),
      dueDay: safeOptionalNumber(card.dueDay),
    };
  });

  const categoryTotals = new Map<
    SafeFinancialCategory,
    { total: number; count: number }
  >();
  for (const category of telemetry.categories) {
    const safeCategory = normalizeFinancialCategory(String(category.category ?? ""));
    const current = categoryTotals.get(safeCategory) ?? { total: 0, count: 0 };
    categoryTotals.set(safeCategory, {
      total: current.total + safeNumber(category.total),
      count: current.count + safeNumber(category.count),
    });
  }

  const totalCategorizedExpenses = Array.from(categoryTotals.values()).reduce(
    (sum, category) => sum + category.total,
    0
  );
  const categories = Array.from(categoryTotals.entries())
    .map(([category, summary]) => ({
      category,
      total: summary.total,
      count: summary.count,
      percentage:
        totalCategorizedExpenses > 0
          ? Math.round((summary.total / totalCategorizedExpenses) * 100)
          : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const toSafePaymentMethod = (account: string): SafePaymentMethod => {
    const normalizedAccount = normalizeForComparison(String(account ?? ""));
    const cardAlias = cardAliases.get(normalizedAccount);
    if (cardAlias) return cardAlias;
    if (/conta|corrente|debito|pix/.test(normalizedAccount)) return "Conta corrente";
    return "Outro meio";
  };

  return {
    profile: {
      monthlyIncomeBase: safeNumber(telemetry.user.monthlyIncomeBase),
      persona,
      riskTolerance,
      aiTone,
      maxCommitmentAlertPercent: safeNumber(telemetry.user.maxCommitmentAlertPercent, 60),
    },
    cashflow: {
      checkingBalance: safeNumber(telemetry.cashflow.checkingBalance),
      monthIncomeRealized: safeNumber(telemetry.cashflow.monthIncomeRealized),
      monthExpenseRealized: safeNumber(telemetry.cashflow.monthExpenseRealized),
      netCashflow: safeNumber(telemetry.cashflow.netCashflow),
      savingsRatePercent: safeNumber(telemetry.cashflow.savingsRatePercent),
    },
    credit: {
      totalLimit: safeNumber(telemetry.credit.totalLimit),
      totalSpent: safeNumber(telemetry.credit.totalSpent),
      availableCredit: safeNumber(telemetry.credit.availableCredit),
      creditUtilizationPercent: safeNumber(telemetry.credit.creditUtilizationPercent),
      cardsCount: safeNumber(telemetry.credit.cardsCount),
      cardsSummary,
    },
    commitments: {
      recurringMonthlyTotal: safeNumber(telemetry.commitments.recurringMonthlyTotal),
      recurringCount: safeNumber(telemetry.commitments.recurringCount),
      commitmentRatioPercent: safeNumber(telemetry.commitments.commitmentRatioPercent),
      isOverLimit: telemetry.commitments.isOverLimit === true,
      recurringItems: telemetry.commitments.recurringItems.map((recurring) => ({
        category: normalizeFinancialCategory(String(recurring.category ?? "")),
        amount: safeNumber(recurring.amount),
        dueDay: safeNumber(recurring.dueDay),
        paymentMethod: toSafePaymentMethod(recurring.account),
        active: true,
      })),
    },
    categories,
    goals: telemetry.goals.map((goal, index) => ({
      alias: `Meta ${index + 1}` as const,
      current: safeNumber(goal.current),
      target: safeNumber(goal.target),
      gap: safeNumber(goal.gap),
      progressPercent: safeNumber(goal.progressPercent),
      deadline: safeDeadline(goal.deadline),
    })),
    monthlyProjections: (telemetry.monthlyProjections || []).map((p) => ({
      monthName: String(p.monthName || ""),
      year: safeNumber(p.year),
      openingBalance: safeNumber(p.openingBalance),
      plannedIncomesTotal: safeNumber(p.plannedIncomesTotal),
      recurringDebitTotal: safeNumber(p.recurringDebitTotal),
      recurringCreditTotal: safeNumber(p.recurringCreditTotal),
      cardInstallments: safeNumber(p.cardInstallments),
      totalCommitted: safeNumber(p.totalCommitted),
      projectedFreeBalance: safeNumber(p.projectedFreeBalance),
    })),
    topSpendItems: (telemetry.topSpendItems || []).map((item) => {
      const isCommercial = isCommonCommercialTerm(item.title);
      let safeTitle = item.title;
      if (!isCommercial) {
        const redacted = redactPersonalData(item.title);
        const nameParts = (telemetry.user.name || "").split(/\s+/).filter((p) => p.length > 2);
        const containsUserName = nameParts.some((p) => item.title.toLowerCase().includes(p.toLowerCase()));
        if (redacted.includes("[") || containsUserName) {
          safeTitle = `${normalizeFinancialCategory(item.category)} (Gasto específico)`;
        } else {
          safeTitle = normalizeFinancialCategory(item.category);
        }
      }
      return {
        title: safeTitle,
        total: safeNumber(item.total),
        count: safeNumber(item.count, 1),
        category: normalizeFinancialCategory(item.category),
        percentage: safeNumber(item.percentage),
      };
    }),
    recentExpenses: (telemetry.recentExpenses || []).map((item) => {
      const isCommercial = isCommonCommercialTerm(item.title);
      let safeTitle = item.title;
      if (!isCommercial) {
        safeTitle = normalizeFinancialCategory(item.category);
      }
      return {
        title: safeTitle,
        amount: safeNumber(item.amount),
        date: String(item.date || ""),
        category: normalizeFinancialCategory(item.category),
      };
    }),
    liquidityAnalysis: telemetry.liquidityAnalysis || {
      currentMonth: {
        monthName: "Mês Atual",
        checkingBalance: safeNumber(telemetry.cashflow.checkingBalance),
        pendingBills: safeNumber(telemetry.cashflow.monthExpenseRealized),
        projectedFreeBalance: safeNumber(telemetry.cashflow.netCashflow),
      },
      nextMonth: {
        monthName: "Próximo Mês",
        projectedIncome: safeNumber(telemetry.user.monthlyIncomeBase),
        committedExpenses: safeNumber(telemetry.commitments.recurringMonthlyTotal),
        cardInstallments: 0,
        recurringDebit: safeNumber(telemetry.commitments.recurringMonthlyTotal),
        recurringCredit: 0,
        projectedFreeBalance: Math.max(
          0,
          safeNumber(telemetry.user.monthlyIncomeBase) - safeNumber(telemetry.commitments.recurringMonthlyTotal)
        ),
      },
    },
  };
}

/**
 * Simula o impacto numérico de uma compra no saldo, faturas e compromisso
 */
export function simulatePurchaseImpact(
  input: PurchaseSimulationInput,
  telemetry: FinancialTelemetry,
  cards: CardItem[]
): PurchaseSimulationResult {
  const { amount, method, installments = 1, cardId } = input;
  const safeInstallments = Math.max(1, Math.min(installments, 48));
  const monthlyInstallmentAmount = amount / safeInstallments;

  const selectedCard = cards.find((c) => c.id === cardId) || cards.find((c) => c.type === "credit");
  const creditCards = cards.filter((card) => card.type === "credit");
  const selectedCreditCardIndex = selectedCard
    ? creditCards.findIndex((card) => card.id === selectedCard.id)
    : -1;
  const cardName =
    selectedCreditCardIndex >= 0 ? `Cartão ${selectedCreditCardIndex + 1}` : "Cartão de Crédito";

  const beforeCheckingBalance = telemetry.cashflow.checkingBalance;
  const beforeCardSpent = selectedCard?.spent || selectedCard?.invoiceAmount || 0;
  const beforeCardAvailable = selectedCard
    ? Math.max(0, selectedCard.limit - beforeCardSpent)
    : telemetry.credit.availableCredit;
  const beforeCommitment = telemetry.commitments.commitmentRatioPercent;

  let afterCheckingBalance = beforeCheckingBalance;
  let afterCardSpent = beforeCardSpent;
  let afterCardAvailable = beforeCardAvailable;
  let afterCommitment = beforeCommitment;

  if (method === "cash") {
    afterCheckingBalance = beforeCheckingBalance - amount;
  } else {
    // Compra no crédito
    afterCardSpent = beforeCardSpent + monthlyInstallmentAmount;
    afterCardAvailable = Math.max(0, beforeCardAvailable - amount);
    const addedCommitment =
      telemetry.user.monthlyIncomeBase > 0
        ? (monthlyInstallmentAmount / telemetry.user.monthlyIncomeBase) * 100
        : 0;
    afterCommitment = Math.round(beforeCommitment + addedCommitment);
  }

  // Determinação do Veredito
  let verdict: "safe" | "warning" | "critical" = "safe";
  let verdictMessage = "Compra totalmente dentro dos parâmetros orçamentários.";

  if (method === "cash") {
    if (afterCheckingBalance < 0) {
      verdict = "critical";
      verdictMessage = `Essa compra deixará sua conta corrente no negativo em R$ ${Math.abs(
        afterCheckingBalance
      ).toFixed(2)}.`;
    } else if (afterCheckingBalance < telemetry.user.monthlyIncomeBase * 0.15) {
      verdict = "warning";
      verdictMessage =
        "Essa compra consome quase toda a sua reserva de liquidez imediata em conta.";
    }
  } else {
    if (selectedCard && amount > beforeCardAvailable) {
      verdict = "critical";
      verdictMessage = `O valor de R$ ${amount.toFixed(2)} excede o limite disponível de R$ ${beforeCardAvailable.toFixed(2)} no cartão ${cardName}.`;
    } else if (afterCommitment > telemetry.user.maxCommitmentAlertPercent) {
      verdict = "warning";
      verdictMessage = `A parcela de R$ ${monthlyInstallmentAmount.toFixed(
        2
      )}/mês eleva seu comprometimento de renda para ${afterCommitment}%, ultrapassando seu teto recomendado de ${
        telemetry.user.maxCommitmentAlertPercent
      }%.`;
    }
  }

  const impactSummary =
    method === "cash"
      ? `Impacto imediato no saldo: R$ ${beforeCheckingBalance.toFixed(2)} ➔ R$ ${afterCheckingBalance.toFixed(2)}.`
      : `Parcela de R$ ${monthlyInstallmentAmount.toFixed(2)} em ${safeInstallments}x no ${cardName}. Limite restante: R$ ${afterCardAvailable.toFixed(2)}.`;

  return {
    amount,
    method,
    installments: safeInstallments,
    monthlyInstallmentAmount,
    cardName,
    before: {
      checkingBalance: beforeCheckingBalance,
      cardInvoice: beforeCardSpent,
      cardAvailableLimit: beforeCardAvailable,
      monthlyCommitmentPercent: beforeCommitment,
    },
    after: {
      checkingBalance: afterCheckingBalance,
      cardInvoice: afterCardSpent,
      cardAvailableLimit: afterCardAvailable,
      monthlyCommitmentPercent: afterCommitment,
    },
    verdict,
    verdictMessage,
    impactSummary,
  };
}

/**
 * Cria a instrução de sistema (System Prompt) para o Analista Financeiro
 */
export function buildFinancialAnalystSystemPrompt(context: SafeFinancialContext): string {
  const {
    profile,
    cashflow,
    credit,
    commitments,
    categories,
    goals,
    topSpendItems,
    recentExpenses,
    liquidityAnalysis,
  } = context;

  const personaGuide = {
    optimizer:
      "Arquetipo: OPTIMIZER. Foco implacável em eficiência de capital, aproveitamento de prazos de fatura, milhas/cashback e cortes cirúrgicos de desperdício.",
    guardian:
      "Arquetipo: GUARDIAN. Foco primário em preservação do patrimônio, liquidez de emergência, aversão ao risco e zero tolerância a endividamento ou rotativo.",
    scaler:
      "Arquetipo: SCALER. Foco em alavancagem inteligente, expansão de investimentos, fluxo de caixa livre e cumprimento acelerado de grandes metas.",
    minimalist:
      "Arquetipo: MINIMALIST. Foco em simplificação máxima, despesas essenciais, eliminação de assinaturas ociosas e tranquilidade financeira.",
  }[profile.persona];

  const toneGuide = {
    analytical:
      "Tom: Analítico e técnico. Use percentuais, números exatos em Reais (R$), métricas comparativas e raciocínio lógico estruturado.",
    direct:
      "Tom: Direto e objetivo. Seja conciso, vá direto ao ponto, destaque o veredito primeiro e liste ações imediatas sem rodeios.",
    collaborative:
      "Tom: Colaborativo e motivador. Seja empático, encorajador, explique o 'porquê' com clareza e celebre o progresso do usuário.",
  }[profile.aiTone];

  return `Você é o ASSISTENTE E ANALISTA FINANCEIRO PESSOAL do usuário no Wallet App.
Seu papel é atuar como um consultor financeiro dedicado: você pega toda a complexidade de dados cruzados (saldo, cartões, faturas, vencimentos, parcelamentos e metas) e traduz tudo para o usuário em um formato simples, natural e intuitivo.

=== DIRETRIZES DE COMUNICAÇÃO (OBRIGATÓRIO) ===
- PADRÃO FORMAL, PORÉM INTUITIVO E SIMPLES: Converse com o usuário de forma educada, acolhedora e natural em primeira pessoa ("Analisei seu cenário...", "Recomendo que você...").
- DADOS COMPLEXOS, CONCLUSÕES CLARAS: Nunca use jargões frios de telemetria ou estatística. Explique a situação financeira como um assistente de confiança que quer ajudar seu cliente a prosperar.
- ${personaGuide}
- ${toneGuide}
- Tolerância a Risco: ${profile.riskTolerance.toUpperCase()}
- Idioma obrigatório: Português do Brasil (pt-BR). Formate valores em Reais (R$ 0.000,00) e percentuais com %.

=== DIRETRIZES FUNDAMENTAIS DE ANÁLISE SOLICITADAS PELO USUÁRIO ===
1. ANÁLISE DE GASTOS ESPECÍFICOS & CONSUMO FREQUENTE (ex: iFood, Delivery, Comidas):
   - Inspecione a lista de despesas específicas e aponte nominalmente quando o usuário estiver gastando muito em determinados itens ou hábitos (por exemplo: iFood, refeições fora de casa, delivery, transporte por app, assinaturas).
   - Aponte valores concretos e número de pedidos/transações (ex: "Notei que você gastou R$ X com iFood/delivery em Y pedidos este mês, o que consome Z% do total das suas despesas").
   - Dê dicas construtivas de equilíbrio para economizar nesses itens sem abrir mão do conforto.

2. LIQUIDEZ EXATA: QUANTO TEM AINDA HOJE vs QUANTO TEM PARA GASTAR MÊS QUE VEM:
   - Se o usuário perguntar quanto tem ainda hoje, declare o Saldo Atual da Conta Corrente e o Saldo Livre restante deste mês.
   - Se o usuário perguntar quanto tem para gastar mês que vem ou quanto tem de gastos mês que vem:
     * Diga quanto está previsto para entrar (Renda Prevista);
     * Diga quanto já está comprometido de despesas (faturas de cartão + contas fixas recorrentes);
     * Informe com destaque o **Saldo Livre Projetado para Gastar** no mês seguinte.

3. GASTOS PARCELADOS AO LONGO DO TEMPO (MATURIDADE CONTÁBIL - NÃO ALARMISMO):
   - Entenda a realidade financeira: despesas no cartão costumam ser parceladas e divididas mês a mês.
   - Ter um total parcelado futuro de R$ 2.000, R$ 3.000 ou mais distribuído nos próximos meses NÃO significa que o usuário está no vermelho ou em situação crítica!
   - Separe as datas e meses específicos de cada vencimento de fatura. Se o saldo livre de cada mês permanecer positivo após pagar a fatura e as contas fixas, declare com clareza que o fluxo de caixa está saudável e sob controle.
   - Apenas alerte se em algum mês específico o total de faturas somado às contas fixas for superior à renda, gerando déficit contábil.

=== CONTEXTO FINANCEIRO DO USUÁRIO ===
1. RENDA & FLUXO DE CAIXA REALIZADO:
   - Renda Base Mensal: R$ ${profile.monthlyIncomeBase.toFixed(2)}
   - Saldo Atual na Conta Corrente: R$ ${cashflow.checkingBalance.toFixed(2)}
   - Entradas Realizadas no Mês: R$ ${cashflow.monthIncomeRealized.toFixed(2)}
   - Saídas Realizadas no Mês: R$ ${cashflow.monthExpenseRealized.toFixed(2)}
   - Fluxo Líquido Realizado: R$ ${cashflow.netCashflow.toFixed(2)} (Taxa de Poupança: ${cashflow.savingsRatePercent}%)

2. CARTÕES DE CRÉDITO & FATURAS:
   - Limite Total Consolidado: R$ ${credit.totalLimit.toFixed(2)}
   - Faturas / Gastos Acumulados no Ciclo Atual: R$ ${credit.totalSpent.toFixed(2)} (${credit.creditUtilizationPercent}% do limite total)
   - Limite Disponível Restante: R$ ${credit.availableCredit.toFixed(2)}
   - Cartões Ativos:
${credit.cardsSummary
  .map(
    (c) =>
      `     • ${c.alias}: Limite R$ ${c.limit.toFixed(2)} | Fatura R$ ${c.spent.toFixed(
        2
      )} | Disponível R$ ${c.available.toFixed(2)} | Fecha dia ${c.closingDay ?? "N/A"}, Vence dia ${
        c.dueDay ?? "N/A"
      }`
  )
  .join("\n")}

3. COMPROMISSO RECORRENTE & GASTOS FIXOS:
   - Total em Despesas Recorrentes/Fixas: R$ ${commitments.recurringMonthlyTotal.toFixed(2)}/mês
   - Taxa de Comprometimento Atual (Recorrentes + Faturas / Renda): ${commitments.commitmentRatioPercent}% (Teto de Alerta: ${profile.maxCommitmentAlertPercent}%)
   - Status de Alerta de Comprometimento: ${commitments.isOverLimit ? "⚠️ EM ALERTA (Acima do teto)" : "✅ DENTRO DO LIMITE"}
   - Principais Gastos Fixos:
${commitments.recurringItems
  .map(
    (r) =>
      `     • ${r.category}: R$ ${r.amount.toFixed(2)} (vence dia ${r.dueDay} em ${r.paymentMethod}; ativo)`
  )
  .join("\n")}

4. PRINCIPAIS CATEGORIAS DE GASTO:
${categories
  .slice(0, 6)
  .map((cat) => `   - ${cat.category}: R$ ${cat.total.toFixed(2)} (${cat.percentage}% do total gasto)`)
  .join("\n")}

5. METAS FINANCEIRAS ATIVAS:
${goals
  .map(
    (g) =>
      `   - ${g.alias}: R$ ${g.current.toFixed(2)} de R$ ${g.target.toFixed(
        2
      )} (${g.progressPercent}% concluído, faltam R$ ${g.gap.toFixed(2)})${
        g.deadline ? ` [Prazo: ${g.deadline}]` : ""
      }`
  )
  .join("\n")}

${
  context.monthlyProjections && context.monthlyProjections.length > 0
    ? `\n6. PROJEÇÃO REAL MÊS A MÊS (Calculada pelo motor do livro-caixa do sistema):\n` +
      context.monthlyProjections
        .map(
          (p, idx) => `   • ${p.monthName}/${p.year} (${idx === 0 ? "Mês Atual" : `Mês +${idx}`}):
     - Saldo Inicial que entra no mês: R$ ${p.openingBalance.toFixed(2)}
     - Entradas Planejadas: R$ ${p.plannedIncomesTotal.toFixed(2)}
     - Contas Fixas em Débito: R$ ${p.recurringDebitTotal.toFixed(2)}
     - Faturas de Cartão (Parcelamentos + Assinaturas Crédito): R$ ${(p.cardInstallments + p.recurringCreditTotal).toFixed(2)}
     - Total Comprometido (Saídas Previstas): R$ ${p.totalCommitted.toFixed(2)}
     - Saldo Livre Final Projetado: R$ ${p.projectedFreeBalance.toFixed(2)} ${
            p.projectedFreeBalance < 0 ? "⚠️ [DÉFICIT PREVISTO]" : "✅ [SALDO POSITIVO]"
          }`
        )
        .join("\n") +
      `\n\nDIRETRIZES DE INTEGRIDADE CONTÁBIL MÊS A MÊS:
- Não assuma lucros ou sobras que não constem estritamente na linha 'Saldo Livre Final Projetado' de cada mês acima.
- Observe a herança do saldo: se um mês fecha com saldo negativo, o mês seguinte já começa com esse saldo negativo herdado!
- Se as parcelas de cartão diminuírem em determinado mês porque compras parceladas chegam ao fim, aponte isso como o ponto de alívio e dê a data ou mês exato.
- Se algum mês fechar com saldo livre negativo, alerte explicitamente qual é o mês crítico e de quanto será a falta de caixa.
- Nunca afirme que o usuário está lucrando se os meses futuros apresentarem déficit ou se o saldo livre for decrescente!`
    : ""
}

7. LIQUIDEZ REAL: HOJE vs PRÓXIMO MÊS:
   • Mês Atual (${liquidityAnalysis.currentMonth.monthName}):
     - Saldo na Conta Hoje: R$ ${liquidityAnalysis.currentMonth.checkingBalance.toFixed(2)}
     - Contas e Faturas Pendentes até o Fim do Mês: R$ ${liquidityAnalysis.currentMonth.pendingBills.toFixed(2)}
     - Saldo Livre que Resta no Mês Atual: R$ ${liquidityAnalysis.currentMonth.projectedFreeBalance.toFixed(2)}
   • Próximo Mês (${liquidityAnalysis.nextMonth.monthName}):
     - Entradas Planejadas para Entrar: R$ ${liquidityAnalysis.nextMonth.projectedIncome.toFixed(2)}
     - Gastos Já Comprometidos (Faturas + Fixas): R$ ${liquidityAnalysis.nextMonth.committedExpenses.toFixed(2)}
       (Sendo R$ ${liquidityAnalysis.nextMonth.cardInstallments.toFixed(2)} em parcelas de faturas de cartão e R$ ${liquidityAnalysis.nextMonth.recurringDebit.toFixed(2)} em despesas fixas em débito)
     - Saldo Livre Projetado para Gastar Mês que Vem: R$ ${liquidityAnalysis.nextMonth.projectedFreeBalance.toFixed(2)}

8. GASTOS ESPECÍFICOS & ESTABELECIMENTOS MAIS FREQUENTES:
${
  topSpendItems && topSpendItems.length > 0
    ? topSpendItems
        .map(
          (item) =>
            `   • ${item.title}: R$ ${item.total.toFixed(2)} (${item.count} compra(s), ${item.percentage}% dos gastos - Categoria: ${item.category})`
        )
        .join("\n")
    : "   • Sem concentração específica individual detectada."
}
${
  recentExpenses && recentExpenses.length > 0
    ? `\n   Lançamentos Recentes:\n` +
      recentExpenses
        .slice(0, 8)
        .map((r) => `     - ${r.date}: ${r.title} — R$ ${r.amount.toFixed(2)} (${r.category})`)
        .join("\n")
    : ""
}
`;
}
