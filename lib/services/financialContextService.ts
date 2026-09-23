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
  creditAmount?: number;
  debitAmount?: number;
  paymentBreakdown?: string;
  habitCategory?: string;
}

export interface LifestyleHabitSummary {
  habitName: string;
  total: number;
  count: number;
  creditAmount: number;
  debitAmount: number;
  examples: string[];
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
  recentExpenses?: Array<{
    title: string;
    amount: number;
    date: string;
    category: string;
    paymentMethod?: string;
  }>;
  liquidityAnalysis?: LiquidityAnalysis;
  historicalVariableBaseline?: number;
  lifestyleHabits?: LifestyleHabitSummary[];
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
    primaryFocus: string;
    maxCommitmentAlertPercent: number;
  };
  historicalVariableBaseline: number;
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
  recentExpenses: Array<{
    title: string;
    amount: number;
    date: string;
    category: string;
    paymentMethod?: string;
  }>;
  liquidityAnalysis: LiquidityAnalysis;
  lifestyleHabits?: LifestyleHabitSummary[];
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

export function inferHabitCategory(title: string, category: string): string {
  const clean = (title + " " + category)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    /sorvet|chiquinho|acai|açaí|doceria|confeitaria|bolo|cacau show|kopenhagen|gelato|bacio di latte|brownie|sobremesa|milkshake/.test(
      clean
    )
  ) {
    return "Sobremesas & Doces";
  }
  if (
    /mcdonald|burger king|\bbk\b|habib|bobs|subway|lanche|hamburg|pastel|pizza|pizzaria|esfiha|hot dog|snack/.test(
      clean
    )
  ) {
    return "Lanches & Fast Food";
  }
  if (
    /cantina|padaria|cafeteria|\bcafe\b|\bcafé\b|starbucks|pao de queijo|panificadora/.test(
      clean
    )
  ) {
    return "Cafés, Padarias & Cantinas";
  }
  if (
    /ifood|rappi|ubereats|delivery|restaurante|almoco|jantar|churrasc|sushi|comida/.test(
      clean
    )
  ) {
    return "Restaurantes & Delivery";
  }
  if (
    /uber|99pop|\b99\b|taxi|combust|posto\b|gasolina|etanol|estacionamento/.test(
      clean
    )
  ) {
    return "Transporte & Mobilidade";
  }
  if (/farmacia|drogaria|drogasil|raia|medicamento|remedio/.test(clean)) {
    return "Farmácia & Saúde";
  }
  if (
    /cinema|netflix|spotify|prime video|disney|hbo|show|ingresso|jogos|game/.test(
      clean
    )
  ) {
    return "Lazer & Assinaturas";
  }
  return "Outros Hábitos";
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

  // Agrupamento autodidata por item/estabelecimento de despesa (dinâmico e sem marcas fixas)
  const nonSettlementExpenses = expenseTransactions.filter(
    (t) => t.kind !== "invoice_payment" && t.kind !== "invoice_settlement"
  );

  const creditCardNames = new Set(
    creditCards.map((c) => (c.name || "").toLowerCase().trim()).filter(Boolean)
  );

  const isCreditTx = (t: TransactionContextItem): boolean => {
    if (t.cardId) return true;
    const acc = (t.account || "").toLowerCase().trim();
    if (creditCardNames.has(acc)) return true;
    if (/(cartao|cartão|credito|crédito)/i.test(acc)) return true;
    return false;
  };

  interface SpendCluster {
    displayTitle: string;
    cleanTokens: string[];
    compactKey: string;
    total: number;
    count: number;
    creditAmount: number;
    debitAmount: number;
    category: string;
    habitCategory: string;
  }

  const clusters: SpendCluster[] = [];
  const GENERIC_PREFIXES = new Set([
    "supermercado",
    "mercado",
    "posto",
    "loja",
    "drogaria",
    "farmacia",
    "restaurante",
    "bar",
    "auto",
    "padaria",
  ]);

  for (const t of nonSettlementExpenses) {
    const rawTitle = t.title?.trim() || "Despesa Diversa";
    const clean = rawTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const compact = clean.replace(/\s+/g, "");
    const tokens = clean.split(" ").filter((w) => w.length > 1);

    const isCredit = isCreditTx(t);
    const amount = safeNumber(t.amount);
    const creditAdd = isCredit ? amount : 0;
    const debitAdd = isCredit ? 0 : amount;

    // Encontra cluster compatível dinamicamente
    let matched = clusters.find((c) => {
      // 1. Chave compacta idêntica (ex: "mcdonalds" vs "mc donalds")
      if (c.compactKey === compact) return true;
      // 2. Chave compacta inicia com a outra (comprimento >= 4)
      if (
        (c.compactKey.length >= 4 && compact.startsWith(c.compactKey)) ||
        (compact.length >= 4 && c.compactKey.startsWith(compact))
      ) {
        return true;
      }
      // 3. Comparação de tokens com tratamento para prefixos genéricos
      if (tokens.length > 0 && c.cleanTokens.length > 0) {
        const firstToken = tokens[0];
        const cFirstToken = c.cleanTokens[0];
        if (firstToken === cFirstToken) {
          if (GENERIC_PREFIXES.has(firstToken)) {
            const secondToken = tokens[1];
            const cSecondToken = c.cleanTokens[1];
            return Boolean(secondToken && secondToken === cSecondToken);
          }
          if (firstToken.length >= 4) {
            return true;
          }
        }
      }
      return false;
    });

    let displayTitle = rawTitle;
    if (compact.includes("mcdonald")) displayTitle = "McDonald's";
    else if (compact === "bk" || compact.includes("burgerking")) displayTitle = "Burger King";
    else if (compact === "ifood") displayTitle = "iFood";
    else if (compact === "uber") displayTitle = "Uber";
    else if (compact === "cantina") displayTitle = "Cantina";

    if (matched) {
      matched.total += amount;
      matched.count += 1;
      matched.creditAmount += creditAdd;
      matched.debitAmount += debitAdd;
      if (displayTitle.length < matched.displayTitle.length && displayTitle.length >= 3) {
        matched.displayTitle = displayTitle;
      }
    } else {
      const habitCategory = inferHabitCategory(rawTitle, t.category || "");
      clusters.push({
        displayTitle,
        cleanTokens: tokens,
        compactKey: compact,
        total: amount,
        count: 1,
        creditAmount: creditAdd,
        debitAmount: debitAdd,
        category: t.category || "Outros",
        habitCategory,
      });
    }
  }

  const topSpendItems: SpecificSpendItem[] = clusters
    .map((item) => {
      const parts: string[] = [];
      if (item.creditAmount > 0) parts.push(`Crédito: R$ ${item.creditAmount.toFixed(2)}`);
      if (item.debitAmount > 0) parts.push(`Débito: R$ ${item.debitAmount.toFixed(2)}`);
      const paymentBreakdown = parts.join(" | ") || "À vista";

      return {
        title: item.displayTitle,
        total: item.total,
        count: item.count,
        creditAmount: item.creditAmount,
        debitAmount: item.debitAmount,
        paymentBreakdown,
        habitCategory: item.habitCategory,
        category: item.category,
        percentage: totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // Agrupamento macro por estilo de vida & hábitos de consumo
  const habitMap = new Map<
    string,
    {
      total: number;
      count: number;
      creditAmount: number;
      debitAmount: number;
      examples: Set<string>;
    }
  >();

  for (const c of clusters) {
    const habit = c.habitCategory;
    if (habit === "Outros Hábitos" && c.count <= 1) continue;
    const current = habitMap.get(habit) || {
      total: 0,
      count: 0,
      creditAmount: 0,
      debitAmount: 0,
      examples: new Set<string>(),
    };
    current.total += c.total;
    current.count += c.count;
    current.creditAmount += c.creditAmount;
    current.debitAmount += c.debitAmount;
    current.examples.add(c.displayTitle);
    habitMap.set(habit, current);
  }

  const lifestyleHabits: LifestyleHabitSummary[] = Array.from(habitMap.entries())
    .map(([habitName, data]) => ({
      habitName,
      total: data.total,
      count: data.count,
      creditAmount: data.creditAmount,
      debitAmount: data.debitAmount,
      examples: Array.from(data.examples).slice(0, 4),
    }))
    .sort((a, b) => b.total - a.total);

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
      paymentMethod: isCreditTx(t) ? "Crédito" : "Débito",
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

  // Baseline de gastos variáveis do dia a dia (excluindo compromissos fixos e parcelas de fatura)
  const historicalVariableBaseline = Math.max(0, monthExpense - recurringMonthlyTotal);

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
    historicalVariableBaseline,
    lifestyleHabits,
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

  const historicalVariableBaseline = safeNumber(
    telemetry.historicalVariableBaseline,
    Math.max(
      0,
      safeNumber(telemetry.cashflow.monthExpenseRealized) -
        safeNumber(telemetry.commitments.recurringMonthlyTotal)
    )
  );

  let safePrimaryFocus = redactPersonalData(
    telemetry.user.primaryFocus || "Equilíbrio financeiro e metas"
  ).trim();
  const userPersonalNameParts = (telemetry.user.name || "")
    .split(/\s+/)
    .filter((p) => p.length > 2);
  for (const part of userPersonalNameParts) {
    const reg = new RegExp(part, "gi");
    safePrimaryFocus = safePrimaryFocus.replace(reg, "Usuário");
  }

  return {
    profile: {
      monthlyIncomeBase: safeNumber(telemetry.user.monthlyIncomeBase),
      persona,
      riskTolerance,
      aiTone,
      primaryFocus: safePrimaryFocus,
      maxCommitmentAlertPercent: safeNumber(telemetry.user.maxCommitmentAlertPercent, 60),
    },
    historicalVariableBaseline,
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
      // Preserva o nome do titular/estabelecimento real, removendo apenas identificadores pessoais do usuário
      let safeTitle = redactPersonalData(item.title || "").trim();
      const nameParts = (telemetry.user.name || "").split(/\s+/).filter((p) => p.length > 2);
      if (nameParts.some((p) => safeTitle.toLowerCase().includes(p.toLowerCase()))) {
        safeTitle = `${normalizeFinancialCategory(item.category)} (Transferência Própria)`;
      }
      if (!safeTitle) {
        safeTitle = normalizeFinancialCategory(item.category);
      }
      return {
        title: safeTitle,
        total: safeNumber(item.total),
        count: safeNumber(item.count, 1),
        creditAmount: safeNumber(item.creditAmount),
        debitAmount: safeNumber(item.debitAmount),
        paymentBreakdown: item.paymentBreakdown || "À vista",
        habitCategory: item.habitCategory,
        category: normalizeFinancialCategory(item.category),
        percentage: safeNumber(item.percentage),
      };
    }),
    recentExpenses: (telemetry.recentExpenses || []).map((item) => {
      // Preserva a descrição real da despesa, removendo dados pessoais sensíveis
      let safeTitle = redactPersonalData(item.title || "").trim();
      const nameParts = (telemetry.user.name || "").split(/\s+/).filter((p) => p.length > 2);
      if (nameParts.some((p) => safeTitle.toLowerCase().includes(p.toLowerCase()))) {
        safeTitle = `${normalizeFinancialCategory(item.category)} (Transferência Própria)`;
      }
      if (!safeTitle) {
        safeTitle = normalizeFinancialCategory(item.category);
      }
      return {
        title: safeTitle,
        amount: safeNumber(item.amount),
        date: String(item.date || ""),
        category: normalizeFinancialCategory(item.category),
        paymentMethod: item.paymentMethod || "Conta",
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
    lifestyleHabits: (telemetry.lifestyleHabits || []).map((h) => ({
      habitName: h.habitName,
      total: safeNumber(h.total),
      count: safeNumber(h.count),
      creditAmount: safeNumber(h.creditAmount),
      debitAmount: safeNumber(h.debitAmount),
      examples: (h.examples || []).map((ex) => redactPersonalData(ex).trim()).filter(Boolean),
    })),
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

  return `Você é o ANALISTA FINANCEIRO PESSOAL (Personal CFO) do usuário no Wallet App.
Você atua como um parceiro e consultor financeiro de alto nível que trabalha lado a lado com o usuário: direto, objetivo, analítico e focado em números reais e padrões de comportamento.

=== POSTURA E DIRETRIZES DE COMUNICAÇÃO (OBRIGATÓRIO) ===
- SEM TEXTINHO E SEM BLÁ BLÁ BLÁ: Elimine introduções vazias, saudações clichês e parágrafos longos de autoajuda. Vá direto aos números e às conclusões práticas.
- OBJETIVIDADE EXECUTIVA: Entregue diagnósticos cirúrgicos, tópicos com marcadores e valores destacados em negrito. Cada frase deve carregar informação financeira útil.
- ${personaGuide}
- ${toneGuide}
- Tolerância a Risco: ${profile.riskTolerance.toUpperCase()}
- Idioma obrigatório: Português do Brasil (pt-BR). Formate valores em Reais (R$ 0.000,00) e percentuais com %.

=== REGRAS FUNDAMENTAIS DO ANALISTA FINANCEIRO ===
1. REGRA CONTÁBIL DE OURO: CAIXA ATUAL vs CARTÃO NO MÊS SEGUINTE
   - Mês Atual: Trabalhe rigorosamente com as ENTRADAS e SAÍDAS REAIS DA CONTA CORRENTE (débito, PIX, contas pagas). Se as entradas superarem as saídas, declare e quantifique a SOBRA LÍQUIDA REAL EM CONTA (saldo positivo).
   - Cartão de Crédito: Compras no cartão NÃO tiram dinheiro da conta corrente no mês em que são feitas. Elas impactam APENAS NO MÊS SEGUINTE (quando a fatura fecha e vence).
   - O Analista deve demonstrar essa visão de fluxo de caixa com clareza:
     * "Neste mês, sua conta está superavitária em +R$ X (entradas menos despesas em débito/PIX)."
     * "Porém, para o mês seguinte, você já acumula R$ Y na fatura do cartão, o que consumirá Z% da sua renda assim que vencer."

2. ANALISTA AUTODIDATA: IDENTIFICAÇÃO DE PADRÕES POR DESCRIÇÃO REAL DOS GASTOS & MEIOS DE PAGAMENTO (CRÉDITO vs DÉBITO)
   - O Analista DEVE inspecionar e padronizar tanto os gastos no CARTÃO DE CRÉDITO quanto no DÉBITO/PIX, considerando as descrições nominais de cada despesa.
   - Identifique e padronize os hábitos de consumo por estabelecimentos/itens específicos (ex: Chiquinho, sorveterias, McDonald's, padarias) E por grupos comportamentais de estilo de vida (ex: "Sobremesas & Doces", "Lanches & Fast Food", "Cafés & Cantinas", "Restaurantes & Delivery", etc.).
   - Sempre quantifique a contagem de compras, o valor total e a segregação clara por meio de pagamento:
     * "Você teve X gastos com [Hábito/Sobremesas/Lanches] totalizando R$ Y (sendo R$ A no cartão de crédito e R$ B no débito/PIX)."
   - Alerte sobre micro-ralos: gastos recorrentes em sobremesas, lanches ou delivery divididos entre crédito e débito muitas vezes somam centenas de reais de forma invisível.

3. REALITY CHECK DE MESES FUTUROS (SEM ILUSÕES CONTÁBEIS E SEM EXTREMOS):
   - Nas projeções futuras do livro-caixa (ex: próximos meses ou final do ano, como Dezembro), constam apenas as despesas fixas e as parcelas de cartão já agendadas até o momento.
   - O Analista DEVE ponderar que o usuário naturalmente terá despesas variáveis do dia a dia (alimentação, transporte, lazer, imprevistos) que ainda não foram lançadas.
   - O baseline histórico de gastos variáveis do usuário é de aproximadamente **R$ ${context.historicalVariableBaseline.toFixed(2)}/mês**.
   - Ao analisar ou projetar meses futuros, NÃO tome a ausência de compras como garantia de sobra bruta total e nem como uma verdade absoluta.
   - Oriente com responsabilidade de CFO: aponte o saldo livre nominal projetado, mas faça a ressalva preventiva ponderando que, descontando o gasto variável diário habitual (~R$ ${context.historicalVariableBaseline.toFixed(2)}), a folga real de caixa será menor. Isso evita falsas sensações de dinheiro sobrando para assumir novos parcelamentos.

4. PERFIL INTEGRAL DO CLIENTE (ALINHAMENTO ESTRATÉGICO):
   - Renda Fixa Base Mensal: R$ ${profile.monthlyIncomeBase.toFixed(2)}
   - Arquétipo / Persona: ${profile.persona.toUpperCase()}
   - Tolerância a Risco: ${profile.riskTolerance.toUpperCase()}
   - Foco Primário / Meta Declarada: "${profile.primaryFocus}"
   - Teto Máximo de Comprometimento Recomendado: ${profile.maxCommitmentAlertPercent}%
   - Avalie sempre se o ritmo atual de compras e faturas está coerente com a tolerância ao risco e acelera ou atrasa o foco primário do cliente.

5. GASTOS PARCELADOS AO LONGO DO TEMPO (MATURIDADE CONTÁBIL - NÃO ALARMISMO):
   - Entenda a realidade financeira: despesas no cartão costumam ser parceladas e divididas mês a mês.
   - Ter um total parcelado futuro de R$ 2.000, R$ 3.000 ou mais distribuído nos próximos meses NÃO significa que o usuário está no vermelho ou em situação crítica!
   - Separe as datas e meses específicos de cada vencimento de fatura. Se o saldo livre de cada mês permanecer positivo após pagar a fatura e as contas fixas, declare com clareza que o fluxo de caixa está saudável e sob controle.
   - Apenas alerte se em algum mês específico o total de faturas somado às contas fixas for superior à renda, gerando déficit contábil.

=== CONTEXTO FINANCEIRO DO USUÁRIO ===
1. PERFIL DO CLIENTE & FLUXO DE CAIXA REALIZADO:
   - Renda Base Mensal: R$ ${profile.monthlyIncomeBase.toFixed(2)}
   - Foco Primário Declarado: "${profile.primaryFocus}"
   - Arquétipo Financeiro: ${profile.persona.toUpperCase()} | Risco: ${profile.riskTolerance.toUpperCase()}
   - Baseline Estimado de Gastos Variáveis Habituais: R$ ${context.historicalVariableBaseline.toFixed(2)}/mês
   - Saldo Atual na Conta Corrente: R$ ${cashflow.checkingBalance.toFixed(2)}
   - Entradas Realizadas no Mês: R$ ${cashflow.monthIncomeRealized.toFixed(2)}
   - Saídas Realizadas no Mês (Conta/Débito): R$ ${cashflow.monthExpenseRealized.toFixed(2)}
   - Fluxo Líquido Realizado em Conta: R$ ${cashflow.netCashflow.toFixed(2)} (Taxa de Poupança: ${cashflow.savingsRatePercent}%)

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

8. GASTOS ESPECÍFICOS & ESTABELECIMENTOS MAIS FREQUENTES (COM CRÉDITO / DÉBITO):
${
  topSpendItems && topSpendItems.length > 0
    ? topSpendItems
        .map(
          (item) =>
            `   • ${item.title}: R$ ${item.total.toFixed(2)} (${item.count} compra(s) | ${item.paymentBreakdown || `Crédito: R$ ${(item.creditAmount ?? 0).toFixed(2)} / Débito: R$ ${(item.debitAmount ?? 0).toFixed(2)}`} | ${item.percentage}% dos gastos - Grupo: ${item.habitCategory || item.category})`
        )
        .join("\n")
    : "   • Sem concentração específica individual detectada."
}
${
  recentExpenses && recentExpenses.length > 0
    ? `\n   Lançamentos Recentes:\n` +
      recentExpenses
        .slice(0, 8)
        .map((r) => `     - ${r.date}: ${r.title} — R$ ${r.amount.toFixed(2)} (${r.paymentMethod || "Conta"} - ${r.category})`)
        .join("\n")
    : ""
}

9. GRUPOS MACRO DE ESTILO DE VIDA & HÁBITOS DE CONSUMO (CRÉDITO vs DÉBITO):
${
  context.lifestyleHabits && context.lifestyleHabits.length > 0
    ? context.lifestyleHabits
        .map(
          (h) =>
            `   • ${h.habitName}: R$ ${h.total.toFixed(2)} (${h.count} compra(s) | Crédito: R$ ${h.creditAmount.toFixed(2)} | Débito: R$ ${h.debitAmount.toFixed(2)} - Lançamentos: ${h.examples.join(", ")})`
        )
        .join("\n")
    : "   • Sem agrupamento macro identificado."
}
`;
}
