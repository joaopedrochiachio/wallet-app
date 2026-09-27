import type { SafeFinancialContext } from "./financialContextService.ts";
import {
  isExcludedFromHabitAnalysis,
  inferHabitCategory,
  validateNumbersInText,
} from "./financialContextService.ts";

export interface SpendingPatternItem {
  title: string;
  description: string;
  type: "info" | "warning" | "alert";
}

export interface FutureProjectionItem {
  period: string;
  description: string;
  severity: "info" | "warning" | "alert";
}

export interface ActionableSuggestionItem {
  title: string;
  action: string;
  potentialGain?: string;
  targetGoal?: string;
}

export interface SpecificExpenseAlert {
  item: string;
  totalAmount: number;
  count?: number;
  creditAmount?: number;
  debitAmount?: number;
  paymentBreakdown?: string;
  habitCategory?: string;
  alertType: "info" | "warning" | "alert";
  message: string;
}

export interface CashflowWindowSummary {
  currentMonth: {
    monthName: string;
    checkingBalance: number;
    pendingBills: number;
    projectedFreeBalance: number;
    insight: string;
  };
  nextMonth: {
    monthName: string;
    projectedIncome: number;
    committedExpenses: number;
    cardInstallments: number;
    recurringDebit: number;
    projectedFreeBalance: number;
    insight: string;
  };
}

export interface InstallmentScheduleItem {
  period: string;
  dueDateHint?: string;
  cardInstallmentsAmount: number;
  status: "safe" | "warning" | "alert";
  explanation: string;
}

export interface ClientProfileAssessment {
  persona: string;
  riskTolerance: string;
  monthlyIncomeBase: number;
  primaryFocus: string;
  commitmentLimitPercent: number;
  profileAlignmentInsight: string;
  recommendedActionForGoal?: string;
}

export interface FutureMonthsRealityCheck {
  historicalVariableBaseline: number;
  realityNote: string;
}

export interface FinancialDiagnosis {
  healthScore: number;
  healthStatus: "excellent" | "healthy" | "attention" | "critical";
  executiveSummary: string;
  spendingPatterns: SpendingPatternItem[];
  futureProjections: FutureProjectionItem[];
  actionableSuggestions: ActionableSuggestionItem[];
  specificExpensesAlerts?: SpecificExpenseAlert[];
  cashflowWindow?: CashflowWindowSummary;
  installmentSchedule?: InstallmentScheduleItem[];
  clientProfileAssessment?: ClientProfileAssessment;
  futureMonthsRealityCheck?: FutureMonthsRealityCheck;
}

export function normalizeHealthStatus(
  statusStr: unknown,
  score: number
): "excellent" | "healthy" | "attention" | "critical" {
  const s = String(statusStr || "").toLowerCase();
  if (s.includes("excel") || s.includes("ótimo") || s.includes("otimo")) return "excellent";
  if (s.includes("saud") || s.includes("bom") || s.includes("healthy")) return "healthy";
  if (s.includes("aten") || s.includes("alerta") || s.includes("warning") || s.includes("moderado")) {
    return "attention";
  }
  if (s.includes("crit") || s.includes("grave") || s.includes("danger")) return "critical";

  // Inferência por pontuação
  if (score >= 80) return "excellent";
  if (score >= 65) return "healthy";
  if (score >= 45) return "attention";
  return "critical";
}

export function sanitizeText(str: unknown): string {
  if (typeof str !== "string") return "";
  let clean = str.trim();
  // Remove sobras de JSON caso o texto contenha chaves cruas
  if (clean.startsWith("{") && clean.includes('"executiveSummary"')) {
    const match = clean.match(/"executiveSummary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (match) {
      clean = match[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
    }
  }
  return clean.replace(/\\"/g, '"').replace(/\\n/g, "\n");
}

export function isDismissedPattern(
  itemName: string,
  habitCategory: string | undefined,
  dismissedPatterns: string[] = []
): boolean {
  if (!dismissedPatterns || dismissedPatterns.length === 0) return false;
  const nameNorm = (itemName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  const catNorm = (habitCategory || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  return dismissedPatterns.some((d) => {
    const dNorm = (d || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    if (!dNorm) return false;
    return (
      nameNorm === dNorm ||
      nameNorm.includes(dNorm) ||
      dNorm.includes(nameNorm) ||
      (catNorm && (catNorm === dNorm || catNorm.includes(dNorm) || dNorm.includes(catNorm)))
    );
  });
}

export function safeParseFinancialDiagnosis(
  rawText: string,
  context: SafeFinancialContext,
  dismissedPatterns: string[] = []
): FinancialDiagnosis {
  let candidate = rawText.trim();

  // Remove blocos de código markdown se existirem
  if (candidate.startsWith("```json")) {
    candidate = candidate.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
  } else if (candidate.startsWith("```")) {
    candidate = candidate.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  }

  // Encontra o trecho JSON delimitado por { e }
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidate = candidate.slice(firstBrace, lastBrace + 1);
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    console.warn("[AI_PARSE_WARNING]", {
      errorCode: "INVALID_JSON_FALLBACK",
      message: "Modelo não respondeu JSON estrito. Aplicando heurística determinística de resgate.",
    });
  }

  // 1. Normalização do HealthScore
  let healthScore = 70;
  if (typeof parsed?.healthScore === "number" && !isNaN(parsed.healthScore)) {
    healthScore = Math.max(0, Math.min(100, Math.round(parsed.healthScore)));
  } else {
    // Cálculo de resgate determinístico baseado na taxa de comprometimento
    const ratio = context?.commitments?.commitmentRatioPercent ?? 0;
    if (ratio <= 40) healthScore = 85;
    else if (ratio <= 60) healthScore = 72;
    else if (ratio <= 80) healthScore = 55;
    else healthScore = 35;

    // Se o saldo em conta corrente for negativo, penaliza a nota
    const checkingBalance = context?.cashflow?.checkingBalance ?? 0;
    if (checkingBalance < 0) {
      healthScore = Math.max(20, healthScore - 20);
    }
  }

  // 2. Normalização do HealthStatus
  const healthStatus = normalizeHealthStatus(parsed?.healthStatus, healthScore);

  // 3. Normalização do Resumo Executivo com verificação contra alucinações numéricas
  let executiveSummary = "";
  if (typeof parsed?.executiveSummary === "string" && parsed.executiveSummary.trim()) {
    const rawSummary = sanitizeText(parsed.executiveSummary);
    const allowedTelemetryNumbers = [
      context?.cashflow?.checkingBalance ?? 0,
      Math.abs(context?.cashflow?.checkingBalance ?? 0),
      context?.cashflow?.monthIncomeRealized ?? 0,
      context?.cashflow?.monthExpenseRealized ?? 0,
      context?.cashflow?.netCashflow ?? 0,
      Math.abs(context?.cashflow?.netCashflow ?? 0),
      context?.commitments?.commitmentRatioPercent ?? 0,
      context?.commitments?.recurringMonthlyTotal ?? 0,
      context?.credit?.totalSpent ?? 0,
      context?.profile?.monthlyIncomeBase ?? 0,
      context?.profile?.maxCommitmentAlertPercent ?? 70,
      context?.historicalVariableBaseline ?? 0,
      context?.liquidityAnalysis?.currentMonth.projectedFreeBalance ?? 0,
      Math.abs(context?.liquidityAnalysis?.currentMonth.projectedFreeBalance ?? 0),
      context?.liquidityAnalysis?.nextMonth.projectedFreeBalance ?? 0,
      Math.abs(context?.liquidityAnalysis?.nextMonth.projectedFreeBalance ?? 0),
      context?.liquidityAnalysis?.nextMonth.cardInstallments ?? 0,
    ];
    if (validateNumbersInText(rawSummary, allowedTelemetryNumbers, 1.0)) {
      executiveSummary = rawSummary;
    }
  }

  if (!executiveSummary) {
    const checkingBalance = context?.cashflow?.checkingBalance ?? 0;
    const netFormatted =
      checkingBalance >= 0
        ? `positivo em R$ ${checkingBalance.toFixed(2)}`
        : `negativo em R$ ${Math.abs(checkingBalance).toFixed(2)}`;
    const ratio = context?.commitments?.commitmentRatioPercent ?? 0;
    const alertLimit = context?.profile?.maxCommitmentAlertPercent ?? 70;
    const statusWord =
      ratio > alertLimit
        ? "está acima da faixa de alerta recomendada"
        : "está sob controle";

    executiveSummary = `Olá! Analisei todo o seu fluxo deste mês. Seu saldo em conta fechou ${netFormatted}, mas o comprometimento total com cartões e despesas fixas ${statusWord}. Estou acompanhando cada movimentação de perto para sugerir passos simples que mantenham sua estabilidade e acelerem suas metas.`;
  }

  // 4. Normalização e Sincronização de Padrões de Consumo
  const spendingPatterns: SpendingPatternItem[] = [];
  const rawPatterns = parsed?.spendingPatterns;
  if (Array.isArray(rawPatterns)) {
    for (const p of rawPatterns) {
      if (typeof p === "string") {
        const text = sanitizeText(p);
        if (text) {
          spendingPatterns.push({
            title: "Padrão Identificado",
            description: text,
            type: "info",
          });
        }
      } else if (p && typeof p === "object") {
        const item = p as Record<string, unknown>;
        const title = String(item.title || "Comportamento de Consumo").trim();
        const desc = sanitizeText(item.description || item.detalhe || "");
        if (title && desc) {
          spendingPatterns.push({
            title,
            description: desc,
            type: (item.type as "info" | "warning" | "alert") || "info",
          });
        }
      }
    }
  } else if (typeof rawPatterns === "string" && rawPatterns.trim()) {
    spendingPatterns.push({
      title: "Análise de Gastos",
      description: sanitizeText(rawPatterns),
      type: "info",
    });
  }

  // Sincroniza e enriquece com grupos de estilo de vida consolidados (count >= 2)
  if (context.lifestyleHabits && context.lifestyleHabits.length > 0) {
    const validHabits = context.lifestyleHabits.filter(
      (h) =>
        !isExcludedFromHabitAnalysis(h.habitName) &&
        h.habitName !== "Alimentação Geral" &&
        h.habitName !== "Outros Hábitos" &&
        h.count >= 2 &&
        !isDismissedPattern(h.habitName, undefined, dismissedPatterns)
    );

    for (const habit of validHabits) {
      const habitNorm = habit.habitName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const alreadyListed = spendingPatterns.some((sp) => {
        const fullNorm = `${sp.title} ${sp.description}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return fullNorm.includes(habitNorm);
      });

      if (!alreadyListed) {
        const breakdown =
          habit.creditAmount > 0 && habit.debitAmount > 0
            ? `Crédito: R$ ${habit.creditAmount.toFixed(2)} | Débito: R$ ${habit.debitAmount.toFixed(2)}`
            : habit.creditAmount > 0
            ? `100% no Crédito (R$ ${habit.creditAmount.toFixed(2)})`
            : `100% no Débito/PIX (R$ ${habit.debitAmount.toFixed(2)})`;

        spendingPatterns.push({
          title: `Hábito: ${habit.habitName}`,
          description: `Identificados ${habit.count} gastos acumulando R$ ${habit.total.toFixed(2)} (${breakdown}${habit.examples?.length ? ` — ex: ${habit.examples.join(", ")}` : ""}).`,
          type: habit.total > 150 || habit.count >= 4 ? "warning" : "info",
        });
      }
    }
  }

  // Complementa com estabelecimentos frequentes de destaque (count >= 2)
  if (context.topSpendItems && context.topSpendItems.length > 0) {
    const validSpends = context.topSpendItems.filter(
      (item) =>
        !isExcludedFromHabitAnalysis(item.title, item.category) &&
        item.count >= 2 &&
        !isDismissedPattern(item.title, item.habitCategory, dismissedPatterns)
    );

    for (const item of validSpends) {
      const itemNorm = item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const alreadyListed = spendingPatterns.some((sp) => {
        const fullNorm = `${sp.title} ${sp.description}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return fullNorm.includes(itemNorm);
      });

      if (!alreadyListed) {
        spendingPatterns.push({
          title: `Recorrência: ${item.title}`,
          description: `${item.count} compras acumulando R$ ${item.total.toFixed(2)} (${item.paymentBreakdown || "À vista"}).`,
          type: item.percentage >= 10 || item.total > 150 ? "warning" : "info",
        });
      }
    }
  }

  if (spendingPatterns.length === 0) {
    spendingPatterns.push({
      title: "Concentração por Categoria",
      description:
        context.categories.length > 0
          ? `A maior fatia das suas despesas esteve concentrada em ${context.categories[0].category} (${context.categories[0].percentage}% do total gasto).`
          : "Seus lançamentos estão distribuídos entre as despesas essenciais do dia a dia.",
      type: "info",
    });
  }

  // 5. Normalização de Projeções Futuras
  const futureProjections: FutureProjectionItem[] = [];
  const rawProjections = parsed?.futureProjections;
  if (Array.isArray(rawProjections)) {
    for (const proj of rawProjections) {
      if (typeof proj === "string") {
        futureProjections.push({
          period: "Próximas Faturas",
          description: sanitizeText(proj),
          severity: "info",
        });
      } else if (proj && typeof proj === "object") {
        const item = proj as Record<string, unknown>;
        futureProjections.push({
          period: String(item.period || item.prazo || "Próximo Ciclo"),
          description: sanitizeText(item.description || item.detalhe || ""),
          severity: (item.severity as "info" | "warning" | "alert") || "info",
        });
      }
    }
  } else if (typeof rawProjections === "string" && rawProjections.trim()) {
    futureProjections.push({
      period: "Próximos 30 dias",
      description: sanitizeText(rawProjections),
      severity: "info",
    });
  }

  if (futureProjections.length === 0) {
    const totalInvoices = context.credit.totalSpent;
    futureProjections.push({
      period: "Próximas Faturas",
      description:
        totalInvoices > 0
          ? `Você tem um total acumulado de faturas de R$ ${totalInvoices.toFixed(
              2
            )} programado para vencer nas próximas semanas.`
          : "Nenhuma fatura pesada acumulada para o próximo vencimento.",
      severity: totalInvoices > context.profile.monthlyIncomeBase * 0.5 ? "warning" : "info",
    });
  }

  // 6. Normalização de Recomendações Práticas
  const actionableSuggestions: ActionableSuggestionItem[] = [];
  const rawSuggestions = parsed?.actionableSuggestions;
  if (Array.isArray(rawSuggestions)) {
    for (const sug of rawSuggestions) {
      if (typeof sug === "string") {
        actionableSuggestions.push({
          title: "Orientação do Assistente",
          action: sanitizeText(sug),
          potentialGain: "Mais folga no orçamento",
        });
      } else if (sug && typeof sug === "object") {
        const item = sug as Record<string, unknown>;
        actionableSuggestions.push({
          title: String(item.title || "Sugestão Prática"),
          action: sanitizeText(item.action || item.descricao || ""),
          potentialGain: item.potentialGain ? String(item.potentialGain) : undefined,
          targetGoal: item.targetGoal ? String(item.targetGoal) : undefined,
        });
      }
    }
  }

  if (actionableSuggestions.length === 0) {
    actionableSuggestions.push({
      title: "Reserva e Equilíbrio",
      action:
        "Separe uma quantia fixa logo no início do mês antes de comprometer o limite com novas compras parceladas.",
      potentialGain: "Segurança de liquidez",
    });
  }

  // 7. Normalização de Alertas de Gastos Específicos & Hábitos (com Débito vs Crédito)
  const specificExpensesAlerts: SpecificExpenseAlert[] = [];
  const rawSpecific =
    parsed?.specificExpensesAlerts ||
    parsed?.specificExpenseAlerts ||
    parsed?.gastosEspecificos ||
    parsed?.alertasGastos;

  const realHabitsLookup = new Map(
    (context.lifestyleHabits || []).map((h) => [h.habitName.toLowerCase().trim(), h])
  );
  const realSpendsLookup = new Map(
    (context.topSpendItems || []).map((s) => [s.title.toLowerCase().trim(), s])
  );

  if (Array.isArray(rawSpecific) && rawSpecific.length > 0) {
    for (const item of rawSpecific) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const rawItemName = String(obj.item || "Gasto Frequente");

        // Ignora imediatamente transações operacionais, faturas de cartão, notas manuais e rifas
        if (isExcludedFromHabitAnalysis(rawItemName)) {
          continue;
        }

        // Descarta se o título denotar compra isolada (ex: "(1 compra)")
        if (/\(1\s*compra\)/i.test(rawItemName)) {
          continue;
        }

        // Busca correspondência nos dados reais para garantir zero alucinação
        const normName = rawItemName.toLowerCase().trim();
        const matchedSpend = realSpendsLookup.get(normName) ||
          Array.from(realSpendsLookup.values()).find((s) => s.title.toLowerCase().includes(normName) || normName.includes(s.title.toLowerCase()));
        const matchedHabit = realHabitsLookup.get(normName) ||
          Array.from(realHabitsLookup.values()).find((h) => h.habitName.toLowerCase().includes(normName) || normName.includes(h.habitName.toLowerCase()));

        // Se o modelo inventou um padrão que não existe na telemetria real, descarta imediatamente
        if (!matchedSpend && !matchedHabit) {
          continue;
        }

        const realCount = matchedSpend ? matchedSpend.count : matchedHabit!.count;
        if (realCount < 2) continue;

        const realTotal = matchedSpend ? matchedSpend.total : matchedHabit!.total;
        const realCredit = matchedSpend ? (matchedSpend.creditAmount ?? 0) : matchedHabit!.creditAmount;
        const realDebit = matchedSpend ? (matchedSpend.debitAmount ?? 0) : matchedHabit!.debitAmount;

        // Reclassifica com precisão
        const refinedHabit = inferHabitCategory(rawItemName, String(obj.habitCategory || (matchedSpend ? matchedSpend.habitCategory : matchedHabit!.habitName)));
        const habitCategory =
          refinedHabit && refinedHabit !== "Outros Hábitos" && refinedHabit !== "Alimentação Geral"
            ? refinedHabit
            : typeof obj.habitCategory === "string" && obj.habitCategory.trim()
            ? sanitizeText(obj.habitCategory)
            : undefined;

        // Ignora se o usuário descartou este padrão
        if (isDismissedPattern(rawItemName, habitCategory, dismissedPatterns)) {
          continue;
        }

        // paymentBreakdown gerado de forma 100% determinística da base real
        const paymentBreakdown =
          realCredit > 0 && realDebit > 0
            ? `Crédito: R$ ${realCredit.toFixed(2)} | Débito: R$ ${realDebit.toFixed(2)}`
            : realCredit > 0
            ? `100% no Crédito (R$ ${realCredit.toFixed(2)})`
            : `100% no Débito/PIX (R$ ${realDebit.toFixed(2)})`;

        // Validação estrita de números no texto da mensagem
        const rawMsg = sanitizeText(String(obj.message || ""));
        const numbersValid = validateNumbersInText(rawMsg, [realCount, realTotal]);
        const finalMessage =
          numbersValid && rawMsg
            ? rawMsg
            : `Identificamos ${realCount} compras em ${matchedSpend ? matchedSpend.title : matchedHabit!.habitName} totalizando R$ ${realTotal.toFixed(2)} (${paymentBreakdown}).`;

        specificExpensesAlerts.push({
          item: matchedSpend ? matchedSpend.title : matchedHabit!.habitName,
          totalAmount: realTotal,
          count: realCount,
          creditAmount: realCredit,
          debitAmount: realDebit,
          paymentBreakdown,
          habitCategory,
          alertType: (obj.alertType as "info" | "warning" | "alert") || "info",
          message: finalMessage,
        });
      }
    }
  }

  // Helper para verificar se um hábito ou estabelecimento já foi incluído nos cards
  const isAlertAlreadyPresent = (name: string, cat?: string) => {
    const norm = (name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const catNorm = (cat || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return specificExpensesAlerts.some((alert) => {
      const aName = (alert.item || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const aCat = (alert.habitCategory || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return (
        aName === norm ||
        aName.includes(norm) ||
        norm.includes(aName) ||
        (catNorm && (aCat === catNorm || aCat.includes(catNorm) || catNorm.includes(aCat)))
      );
    });
  };

  // Complementa com grupos consolidados de estilo de vida (lifestyleHabits) com repetição real (count >= 2)
  if (context.lifestyleHabits && context.lifestyleHabits.length > 0) {
    const validHabits = context.lifestyleHabits.filter(
      (h) =>
        !isExcludedFromHabitAnalysis(h.habitName) &&
        h.habitName !== "Alimentação Geral" &&
        h.habitName !== "Outros Hábitos" &&
        h.count >= 2 &&
        !isDismissedPattern(h.habitName, undefined, dismissedPatterns)
    );

    for (const habit of validHabits) {
      if (!isAlertAlreadyPresent(habit.habitName, habit.habitName)) {
        const isHigh = habit.total > 200 || habit.count >= 4;
        const breakdown =
          habit.creditAmount > 0 && habit.debitAmount > 0
            ? `Crédito: R$ ${habit.creditAmount.toFixed(2)} | Débito: R$ ${habit.debitAmount.toFixed(2)}`
            : habit.creditAmount > 0
            ? `100% no Crédito (R$ ${habit.creditAmount.toFixed(2)})`
            : `100% no Débito/PIX (R$ ${habit.debitAmount.toFixed(2)})`;

        specificExpensesAlerts.push({
          item: habit.habitName,
          totalAmount: habit.total,
          count: habit.count,
          creditAmount: habit.creditAmount,
          debitAmount: habit.debitAmount,
          paymentBreakdown: breakdown,
          habitCategory: habit.habitName,
          alertType: isHigh ? "warning" : "info",
          message: `Identificados ${habit.count} gastos com ${habit.habitName} somando R$ ${habit.total.toFixed(2)} (${breakdown}${habit.examples?.length ? ` — ex: ${habit.examples.join(", ")}` : ""}).`,
        });
      }
    }
  }

  // Complementa com estabelecimentos recorrentes reais em topSpendItems (estritamente count >= 2)
  const validTopSpends = (context.topSpendItems || []).filter(
    (item) =>
      !isExcludedFromHabitAnalysis(item.title, item.category) &&
      item.count >= 2 &&
      !isDismissedPattern(item.title, item.habitCategory, dismissedPatterns)
  );

  for (const item of validTopSpends) {
    if (!isAlertAlreadyPresent(item.title, item.habitCategory)) {
      const isHigh = item.percentage >= 10 || item.total > 150;
      specificExpensesAlerts.push({
        item: item.title,
        totalAmount: item.total,
        count: item.count,
        creditAmount: item.creditAmount,
        debitAmount: item.debitAmount,
        paymentBreakdown: item.paymentBreakdown,
        habitCategory: item.habitCategory,
        alertType: isHigh ? "warning" : "info",
        message: `Identificamos ${item.count} compra(s) em ${item.title} totalizando R$ ${item.total.toFixed(2)} (${item.paymentBreakdown || "À vista"}).`,
      });
    }
  }

  // 8. Normalização da Janela de Liquidez (Hoje vs Mês Que Vem)
  const liq = context?.liquidityAnalysis;
  const rawCashflow = parsed?.cashflowWindow as Record<string, unknown> | undefined;
  const rawCurrent = rawCashflow?.currentMonth as Record<string, unknown> | undefined;
  const rawNext = rawCashflow?.nextMonth as Record<string, unknown> | undefined;

  const currentChecking = liq ? liq.currentMonth.checkingBalance : (context?.cashflow?.checkingBalance ?? 0);
  const currentBills = liq ? liq.currentMonth.pendingBills : (context?.commitments?.recurringMonthlyTotal ?? 0);
  const currentFree = liq ? liq.currentMonth.projectedFreeBalance : (currentChecking - currentBills);

  const nextIncome = liq ? liq.nextMonth.projectedIncome : (context?.profile?.monthlyIncomeBase ?? 0);
  const nextCard = liq ? liq.nextMonth.cardInstallments : (context?.credit?.totalSpent ?? 0);
  const nextDebit = liq ? liq.nextMonth.recurringDebit : (context?.commitments?.recurringMonthlyTotal ?? 0);
  const nextCommitted = liq ? liq.nextMonth.committedExpenses : (nextCard + nextDebit);
  const nextFree = liq ? liq.nextMonth.projectedFreeBalance : (nextIncome - nextCommitted);

  const rawCurrentInsight = typeof rawCurrent?.insight === "string" ? sanitizeText(rawCurrent.insight) : "";
  const currentInsightValid = rawCurrentInsight && validateNumbersInText(rawCurrentInsight, [
    currentChecking,
    Math.abs(currentChecking),
    currentBills,
    currentFree,
    Math.abs(currentFree),
  ]);

  const rawNextInsight = typeof rawNext?.insight === "string" ? sanitizeText(rawNext.insight) : "";
  const nextInsightValid = rawNextInsight && validateNumbersInText(rawNextInsight, [
    nextIncome,
    nextCommitted,
    nextCard,
    nextDebit,
    nextFree,
    Math.abs(nextFree),
  ]);

  const cashflowWindow: CashflowWindowSummary = {
    currentMonth: {
      monthName: liq?.currentMonth.monthName || "Mês Atual",
      checkingBalance: currentChecking,
      pendingBills: currentBills,
      projectedFreeBalance: currentFree,
      insight: currentInsightValid
        ? rawCurrentInsight
        : currentFree >= 0
        ? `Mês positivo: R$ ${currentFree.toFixed(2)} livres em conta após descontar todas as saídas e contas fixas previstas.`
        : `Alerta de fluxo: déficit previsto de R$ ${Math.abs(currentFree).toFixed(2)} na conta este mês.`,
    },
    nextMonth: {
      monthName: liq?.nextMonth.monthName || "Próximo Mês",
      projectedIncome: nextIncome,
      committedExpenses: nextCommitted,
      cardInstallments: nextCard,
      recurringDebit: nextDebit,
      projectedFreeBalance: nextFree,
      insight: nextInsightValid
        ? rawNextInsight
        : `Fatura de cartão de R$ ${nextCard.toFixed(2)} e despesas fixas em débito de R$ ${nextDebit.toFixed(2)}. Saldo livre projetado de R$ ${nextFree.toFixed(2)}.`,
    },
  };

  // 9. Cronograma e Diluição de Parcelas de Cartão
  const installmentSchedule: InstallmentScheduleItem[] = [];
  const rawInstallments = parsed?.installmentSchedule;
  if (Array.isArray(rawInstallments) && rawInstallments.length > 0) {
    for (const item of rawInstallments) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const period = String(obj.period || "Próximo Ciclo").trim();
        const cardInstallmentsAmount =
          typeof obj.cardInstallmentsAmount === "number" ? obj.cardInstallmentsAmount : 0;
        const status = (obj.status as "safe" | "warning" | "alert") || "safe";
        const explanation = sanitizeText(obj.explanation || "");

        installmentSchedule.push({
          period,
          dueDateHint: typeof obj.dueDateHint === "string" ? sanitizeText(obj.dueDateHint) : undefined,
          cardInstallmentsAmount,
          status,
          explanation:
            explanation ||
            `Parcela de cartão prevista de R$ ${cardInstallmentsAmount.toFixed(2)} para este ciclo.`,
        });
      }
    }
  }

  // Fallback para cronograma com base nas projeções reais do motor de projeção
  if (installmentSchedule.length === 0 && context?.monthlyProjections && context.monthlyProjections.length > 0) {
    for (const p of context.monthlyProjections.slice(0, 4)) {
      if (p.cardInstallments > 0) {
        installmentSchedule.push({
          period: `${p.monthName}/${p.year}`,
          dueDateHint: "Fatura programada",
          cardInstallmentsAmount: p.cardInstallments,
          status: p.projectedFreeBalance >= 0 ? "safe" : "alert",
          explanation:
            p.projectedFreeBalance >= 0
              ? `Parcelas de cartão de R$ ${p.cardInstallments.toFixed(2)} distribuídas de forma equilibrada, com saldo livre final de R$ ${p.projectedFreeBalance.toFixed(2)}.`
              : `Parcelas de cartão somam R$ ${p.cardInstallments.toFixed(2)}, exigindo atenção para cobrir o mês.`,
        });
      }
    }
  }

  // 10. Perfil Completo do Cliente & Alinhamento Estratégico
  const personaLabels: Record<string, string> = {
    optimizer: "Otimizador (Eficiência máxima)",
    guardian: "Guardião (Proteção e liquidez)",
    scaler: "Escalador (Crescimento e metas)",
    minimalist: "Minimalista (Simplicidade e foco)",
  };
  const riskLabels: Record<string, string> = {
    low: "Conservadora",
    moderate: "Moderada",
    high: "Arrojada",
  };
  const rawProfileAssessment = parsed?.clientProfileAssessment as Record<string, unknown> | undefined;
  const persona = context?.profile?.persona || "optimizer";
  const risk = context?.profile?.riskTolerance || "moderate";
  const incomeBase = context?.profile?.monthlyIncomeBase ?? 0;
  const primaryFocus = context?.profile?.primaryFocus || "Equilíbrio financeiro e metas";
  const alertPercent = context?.profile?.maxCommitmentAlertPercent ?? 70;
  const ratio = context?.commitments?.commitmentRatioPercent ?? 0;

  const clientProfileAssessment: ClientProfileAssessment = {
    persona:
      typeof rawProfileAssessment?.persona === "string" && rawProfileAssessment.persona.trim()
        ? sanitizeText(rawProfileAssessment.persona)
        : personaLabels[persona] || "Otimizador",
    riskTolerance:
      typeof rawProfileAssessment?.riskTolerance === "string" && rawProfileAssessment.riskTolerance.trim()
        ? sanitizeText(rawProfileAssessment.riskTolerance)
        : riskLabels[risk] || "Moderada",
    monthlyIncomeBase: incomeBase,
    primaryFocus,
    commitmentLimitPercent: alertPercent,
    profileAlignmentInsight:
      typeof rawProfileAssessment?.profileAlignmentInsight === "string" && rawProfileAssessment.profileAlignmentInsight.trim()
        ? sanitizeText(rawProfileAssessment.profileAlignmentInsight)
        : `Com renda base de R$ ${incomeBase.toFixed(2)} e foco em "${primaryFocus}", seus compromissos fixos e faturas absorvem ${ratio}% do seu orçamento mensal.`,
    recommendedActionForGoal:
      typeof rawProfileAssessment?.recommendedActionForGoal === "string" && rawProfileAssessment.recommendedActionForGoal.trim()
        ? sanitizeText(rawProfileAssessment.recommendedActionForGoal)
        : undefined,
  };

  // 11. Reality Check para Meses Futuros (Ponderação de Gastos Variáveis)
  const rawReality = parsed?.futureMonthsRealityCheck as Record<string, unknown> | undefined;
  const historicalBaseline = context.historicalVariableBaseline || 0;
  const rawRealityNote = typeof rawReality?.realityNote === "string" ? sanitizeText(rawReality.realityNote) : "";
  const realityNoteValid = rawRealityNote && validateNumbersInText(rawRealityNote, [
    historicalBaseline,
    Math.round(historicalBaseline),
  ]);

  const futureMonthsRealityCheck: FutureMonthsRealityCheck = {
    historicalVariableBaseline: historicalBaseline,
    realityNote: realityNoteValid
      ? rawRealityNote
      : historicalBaseline > 0
      ? `Lembrete contábil: meses futuros (como Dezembro) listam apenas parcelas e fixas agendadas. Ponderando seu baseline histórico de gastos variáveis (~R$ ${historicalBaseline.toFixed(2)}/mês), sua folga líquida real será mais moderada do que a sobra bruta indica.`
      : "Meses futuros com faturas baixas abrem espaço para poupar, mas mantenha prudência com novas despesas do dia a dia.",
  };

  return {
    healthScore,
    healthStatus,
    executiveSummary,
    spendingPatterns,
    futureProjections,
    actionableSuggestions,
    specificExpensesAlerts,
    cashflowWindow,
    installmentSchedule,
    clientProfileAssessment,
    futureMonthsRealityCheck,
  };
}
