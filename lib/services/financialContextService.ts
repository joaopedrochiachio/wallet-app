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
export function synthesizeFinancialTelemetry(data: {
  userProfile?: UserProfile | null;
  cards: CardItem[];
  transactions: TransactionContextItem[];
  recurringItems: RecurringItem[];
  goals: GoalItem[];
  mainBalance: number;
  monthIncome: number;
  monthExpense: number;
}): FinancialTelemetry {
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
  const cardName = selectedCard?.name || "Cartão de Crédito";

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
export function buildFinancialAnalystSystemPrompt(telemetry: FinancialTelemetry): string {
  const { user, cashflow, credit, commitments, categories, goals } = telemetry;

  const personaGuide = {
    optimizer:
      "Arquetipo: OPTIMIZER. Foco implacável em eficiência de capital, aproveitamento de prazos de fatura, milhas/cashback e cortes cirúrgicos de desperdício.",
    guardian:
      "Arquetipo: GUARDIAN. Foco primário em preservação do patrimônio, liquidez de emergência, aversão ao risco e zero tolerância a endividamento ou rotativo.",
    scaler:
      "Arquetipo: SCALER. Foco em alavancagem inteligente, expansão de investimentos, fluxo de caixa livre e cumprimento acelerado de grandes metas.",
    minimalist:
      "Arquetipo: MINIMALIST. Foco em simplificação máxima, despesas essenciais, eliminação de assinaturas ociosas e tranquilidade financeira.",
  }[user.persona];

  const toneGuide = {
    analytical:
      "Tom: Analítico e técnico. Use percentuais, números exatos em Reais (R$), métricas comparativas e raciocínio lógico estruturado.",
    direct:
      "Tom: Direto e objetivo. Seja conciso, vá direto ao ponto, destaque o veredito primeiro e liste ações imediatas sem rodeios.",
    collaborative:
      "Tom: Colaborativo e motivador. Seja empático, encorajador, explique o 'porquê' com clareza e celebre o progresso do usuário.",
  }[user.aiTone];

  return `Você é o ANALISTA FINANCEIRO PESSOAL de elite integrado ao Wallet App.
Seu papel é diagnosticar a saúde financeira do usuário, identificar padrões e anomalias de consumo, projetar o fluxo futuro de despesas e responder a simulações de impacto de compras com precisão matemática.

=== DIRETRIZES COMPORTAMENTAIS DO ANALISTA ===
- ${personaGuide}
- ${toneGuide}
- Foco Primário Declarado pelo Usuário: "${user.primaryFocus}"
- Tolerância a Risco: ${user.riskTolerance.toUpperCase()}
- Idioma obrigatório: Português do Brasil (pt-BR). Sempre formate valores como R$ 0.000,00 e percentuais com %.
- NUNCA dê respostas genéricas de conselho comum de autoajuda. Baseie-se ESTRITAMENTE nos dados e telemetria fornecidos abaixo.
- Sempre que o usuário perguntar sobre uma compra futura (ex: "se eu comprar X parcelado em Y"), avalie:
  1. Impacto no saldo disponível ou no limite do cartão;
  2. Nova taxa de comprometimento mensal vs o teto estipulado (${user.maxCommitmentAlertPercent}%);
  3. Risco de atraso nas metas financeiras ativas;
  4. Veredito final categorizado: [SEGURO] (verde), [ATENÇÃO] (amarelo) ou [ALTO RISCO] (vermelho), com sugestão de ajuste se necessário.

=== TELEMETRIA FINANCEIRA DO USUÁRIO (${user.name}) ===
1. RENDA & FLUXO DE CAIXA:
   - Renda Base Mensal: R$ ${user.monthlyIncomeBase.toFixed(2)}
   - Saldo Atual na Conta Corrente: R$ ${cashflow.checkingBalance.toFixed(2)}
   - Entradas Realizadas no Mês: R$ ${cashflow.monthIncomeRealized.toFixed(2)}
   - Saídas Realizadas no Mês: R$ ${cashflow.monthExpenseRealized.toFixed(2)}
   - Fluxo Líquido Realizado: R$ ${cashflow.netCashflow.toFixed(2)} (Taxa de Poupança: ${cashflow.savingsRatePercent}%)

2. CARTÕES DE CRÉDITO & FATURAS:
   - Limite Total Consolidado: R$ ${credit.totalLimit.toFixed(2)}
   - Faturas / Gastos Acumulados: R$ ${credit.totalSpent.toFixed(2)} (${credit.creditUtilizationPercent}% do limite total)
   - Limite Disponível Restante: R$ ${credit.availableCredit.toFixed(2)}
   - Cartões Ativos:
${credit.cardsSummary
  .map(
    (c) =>
      `     • ${c.name} (${c.brand}): Limite R$ ${c.limit.toFixed(2)} | Fatura R$ ${c.spent.toFixed(
        2
      )} | Disponível R$ ${c.available.toFixed(2)} | Fecha dia ${c.closingDay ?? "N/A"}, Vence dia ${
        c.dueDay ?? "N/A"
      }`
  )
  .join("\n")}

3. COMPROMISSO RECORRENTE & GASTOS FIXOS:
   - Total em Despesas Recorrentes/Fixas: R$ ${commitments.recurringMonthlyTotal.toFixed(2)}/mês
   - Taxa de Comprometimento Atual (Recorrentes + Faturas / Renda): ${commitments.commitmentRatioPercent}% (Teto de Alerta: ${user.maxCommitmentAlertPercent}%)
   - Status de Alerta de Comprometimento: ${commitments.isOverLimit ? "⚠️ EM ALERTA (Acima do teto)" : "✅ DENTRO DO LIMITE"}
   - Principais Gastos Fixos:
${commitments.recurringItems
  .map((r) => `     • ${r.title}: R$ ${r.amount.toFixed(2)} (vence dia ${r.dueDay} em ${r.account})`)
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
      `   - ${g.title}: R$ ${g.current.toFixed(2)} de R$ ${g.target.toFixed(
        2
      )} (${g.progressPercent}% concluído, faltam R$ ${g.gap.toFixed(2)})${
        g.deadline ? ` [Prazo: ${g.deadline}]` : ""
      }`
  )
  .join("\n")}
`;
}
