/**
 * financialMathService.ts
 * Motores quantitativos e formulações matemáticas de finanças para o Wallet AI.
 * Implementa de forma determinística e didática:
 * 1. Cashflow at Risk (CFaR) & Teto de Liquidez (Teoria de Caixa)
 * 2. Downside Deviation / Sortino Simplificado (Volatilidade de Perdas & Fundo de Emergência)
 * 3. Float de Fatura & Duration de Passivo (Arbitragem de Prazo vs CDI)
 * 4. Eficiência de Alocação de Metas (Markowitz MPT & Sharpe Didático)
 * 5. Índice de Sobrevivência (Runway em meses/dias)
 */

export interface CashflowRiskAnalysis {
  cfaR: number; // Valor em risco no fechamento (R$)
  probabilityOfSurplus: number; // 0 a 100%
  status: "safe" | "caution" | "critical";
  headline: string;
  explanation: string;
}

export interface EmergencyFundAnalysis {
  runwayMonths: number;
  runwayDays: number;
  sortinoQuality: "excelente" | "moderada" | "baixa";
  sortinoScore: number; // 0 a 100
  safeReserveTarget: number;
  deficitOrSurplus: number;
  headline: string;
  explanation: string;
}

export interface CreditFloatAnalysis {
  averageDurationDays: number;
  opportunityGainCDI: number; // R$ que o dinheiro pode render na conta enquanto a fatura não vence
  bestStrategy: "pagar_a_vista" | "aproveitar_fatura";
  headline: string;
  explanation: string;
}

export interface GoalAllocationEfficiency {
  sharpeEfficiencyScore: number; // 0 a 100
  diversificationStatus: "otimizada" | "concentrada" | "em_risco";
  headline: string;
  explanation: string;
  suggestedAction: string;
}

/**
 * 1. RUBI (CFO): Cashflow at Risk & Projeção Determinística de Caixa
 * Mede se o ritmo diário atual tem margem estatística para fechar o mês sem quebrar a meta.
 */
export function calculateCashflowAtRisk(params: {
  mainBalance: number;
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  monthExpense: number;
  monthIncome: number;
  remainingDays: number;
  safeDailyAllowance: number;
}): CashflowRiskAnalysis {
  const {
    projectedFreeBalance,
    targetEndMonthBalance,
    remainingDays,
    safeDailyAllowance,
  } = params;

  const safetyMargin = projectedFreeBalance - targetEndMonthBalance;
  const days = Math.max(1, remainingDays);

  // Se a margem for positiva, o risco de fechar abaixo é reduzido
  if (safetyMargin >= 0) {
    const cushionRatio = targetEndMonthBalance > 0 ? safetyMargin / targetEndMonthBalance : 1;
    const probability = Math.min(99, Math.round(75 + cushionRatio * 20));
    return {
      cfaR: 0,
      probabilityOfSurplus: probability,
      status: "safe",
      headline: `Fluxo protegido com ${probability}% de segurança`,
      explanation: `Mantendo o teto de até R$ ${safeDailyAllowance.toFixed(2)}/dia nos próximos ${days} dias, você encerra o mês com folga livre de R$ ${safetyMargin.toFixed(2)}.`,
    };
  }

  // Se a margem for negativa (risco real de déficit)
  const deficit = Math.abs(safetyMargin);
  const probability = Math.max(15, Math.round(50 - (deficit / Math.max(1, targetEndMonthBalance)) * 40));
  return {
    cfaR: deficit,
    probabilityOfSurplus: probability,
    status: deficit > 500 ? "critical" : "caution",
    headline: `Risco de caixa: defasagem de R$ ${deficit.toFixed(2)}`,
    explanation: `Para restaurar a meta de R$ ${targetEndMonthBalance.toFixed(2)}, é necessário restringir novos gastos discricionários em R$ ${(deficit / days).toFixed(2)} por dia até o fechamento.`,
  };
}

/**
 * 2. SOL (RESERVA): Análise de Proteção Antifrágil & Cobertura de Sobrevivência (Sortino / VaR)
 * Avalia se o usuário tem fôlego para absorver imprevistos sem precisar de empréstimos ou rotativo.
 */
export function calculateEmergencyProtection(params: {
  reserveBalance: number;
  monthlyFixedExpense: number;
  invisibleDrainsTotal: number;
}): EmergencyFundAnalysis {
  const { reserveBalance, monthlyFixedExpense, invisibleDrainsTotal } = params;
  const fixed = Math.max(100, monthlyFixedExpense);

  // Runway: quantos meses o usuário consegue sobreviver se a renda parar hoje
  const runwayMonths = Number((reserveBalance / fixed).toFixed(1));
  const runwayDays = Math.round(runwayMonths * 30);

  // Meta ideal de reserva: mínimo de 3 a 6 meses de despesas fixas
  const targetMonths = 6;
  const safeReserveTarget = fixed * targetMonths;
  const diff = reserveBalance - safeReserveTarget;

  // Score de Sortino simplificado (penaliza falta de reserva e presença de ralos)
  let sortinoScore = Math.min(100, Math.round((runwayMonths / targetMonths) * 80));
  if (invisibleDrainsTotal > 200) {
    sortinoScore = Math.max(10, sortinoScore - 15);
  }

  let sortinoQuality: "excelente" | "moderada" | "baixa" = "baixa";
  if (sortinoScore >= 75) sortinoQuality = "excelente";
  else if (sortinoScore >= 45) sortinoQuality = "moderada";

  let headline = "";
  let explanation = "";

  if (runwayMonths >= 6) {
    headline = `Blindagem total: ${runwayMonths} meses de fôlego`;
    explanation = `Sua reserva atual suporta suas contas essenciais por cerca de ${runwayDays} dias sem nenhuma nova renda. Seu nível antifrágil está no patamar ideal.`;
  } else if (runwayMonths >= 3) {
    headline = `Proteção intermediária: ${runwayMonths} meses de fôlego`;
    explanation = `Você tem autonomia de ${runwayDays} dias. Recomenda-se aportar até alcançar R$ ${safeReserveTarget.toFixed(2)} para cobrir 6 meses completos de tranquilidade.`;
  } else {
    headline = `Alerta de vulnerabilidade: apenas ${runwayDays} dias de reserva`;
    explanation = `Seus gastos fixos de R$ ${fixed.toFixed(2)}/mês exigem atenção. Qualquer gasto imprevisto pode forçar o uso de limite de crédito ou rotativo.`;
  }

  return {
    runwayMonths,
    runwayDays,
    sortinoQuality,
    sortinoScore,
    safeReserveTarget,
    deficitOrSurplus: diff,
    headline,
    explanation,
  };
}

/**
 * 3. NANQUIM (CRÉDITO): Arbitragem de Fatura & Duration do Passivo
 * Calcula o ganho em rendimento ao pagar no cartão no melhor dia vs pagar à vista sem desconto.
 */
export function calculateCreditFloatOpportunity(params: {
  openInvoicesTotal: number;
  bestCardDaysUntilDue: number; // Dias até o vencimento da melhor opção
  annualCdiRate?: number; // Padrão 10.5% a.a.
}): CreditFloatAnalysis {
  const { openInvoicesTotal, bestCardDaysUntilDue, annualCdiRate = 0.105 } = params;
  const dailyRate = Math.pow(1 + annualCdiRate, 1 / 365) - 1;

  // Rendimento potencial do dinheiro permanecendo aplicado na conta remunerada até a data de vencimento
  const opportunityGainCDI = openInvoicesTotal * dailyRate * Math.max(1, bestCardDaysUntilDue);

  const bestStrategy = bestCardDaysUntilDue >= 15 ? "aproveitar_fatura" : "pagar_a_vista";

  return {
    averageDurationDays: bestCardDaysUntilDue,
    opportunityGainCDI,
    bestStrategy,
    headline: bestCardDaysUntilDue >= 20
      ? `Janela de ouro: ${bestCardDaysUntilDue} dias de prazo livre`
      : `Vencimento próximo: prazo médio de ${bestCardDaysUntilDue} dias`,
    explanation: bestCardDaysUntilDue >= 20
      ? `Usando o cartão certo hoje, seu dinheiro fica rendendo até 100% do CDI na conta por mais de 3 semanas antes do desembolso.`
      : `Faturas próximas de fechamento pedem prudência para evitar acúmulo de compromissos no início da próxima competência.`,
  };
}

/**
 * 4. ATLOS (METAS & ALOCAÇÃO): Eficiência de Alocação de Metas (Markowitz & Sharpe)
 * Traduz MPT e Sharpe Ratio em nota de produtividade da sobra de caixa.
 */
export function calculateGoalEfficiency(params: {
  projectedFreeBalance: number;
  targetEndMonthBalance: number;
  totalGoalsTarget: number;
  currentGoalsSaved: number;
}): GoalAllocationEfficiency {
  const {
    projectedFreeBalance,
    targetEndMonthBalance,
    totalGoalsTarget,
    currentGoalsSaved,
  } = params;

  const surplus = Math.max(0, projectedFreeBalance - targetEndMonthBalance);
  const goalProgress = totalGoalsTarget > 0 ? (currentGoalsSaved / totalGoalsTarget) * 100 : 0;

  // Eficiência Sharpe didática: sobra positiva + progresso de metas com consistência
  const sharpeEfficiencyScore = Math.min(100, Math.round(30 + goalProgress * 0.4 + (surplus > 0 ? 30 : 0)));
  let diversificationStatus: "otimizada" | "concentrada" | "em_risco" = "concentrada";

  if (sharpeEfficiencyScore >= 75) diversificationStatus = "otimizada";
  else if (sharpeEfficiencyScore < 40) diversificationStatus = "em_risco";

  return {
    sharpeEfficiencyScore,
    diversificationStatus,
    headline: surplus > 0
      ? `Excedente produtivo de R$ ${surplus.toFixed(2)} pronto para render`
      : `Metas em espera: foco em garantir o equilíbrio do mês`,
    explanation: surplus > 0
      ? `Sua margem livre cumpre 100% da meta de fechamento. O valor excedente pode ser direcionado para suas metas prioritárias gerando retorno composto.`
      : `Antes de alocar novos aportes em metas de longo prazo, consolide a margem de segurança de curto prazo.`,
    suggestedAction: surplus > 0 ? "Aportar Excedente na Meta Principal" : "Ajustar Ritmo de Gastos Diários",
  };
}
