import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  buildFinancialAnalystSystemPrompt,
  SafeFinancialContext,
} from "@/lib/services/financialContextService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

function normalizeHealthStatus(
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

function sanitizeText(str: unknown): string {
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

function safeParseFinancialDiagnosis(
  rawText: string,
  context: SafeFinancialContext
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
    console.warn("[AI_ANALYZE_PARSE_FAILED]", { errorCode: "INVALID_MODEL_JSON" });
  }

  // 1. Extração do Score
  let healthScore = 75;
  if (parsed && typeof parsed.healthScore === "number") {
    healthScore = Math.max(0, Math.min(100, Math.round(parsed.healthScore)));
  } else {
    const matchScore = rawText.match(/"healthScore"\s*:\s*(\d+)/i);
    if (matchScore) {
      healthScore = Math.max(0, Math.min(100, parseInt(matchScore[1], 10)));
    } else {
      // Cálculo heurístico baseado na telemetria
      const savingsBonus = Math.min(25, context.cashflow.savingsRatePercent * 0.5);
      const commitmentPenalty = context.commitments.isOverLimit ? 35 : 10;
      healthScore = Math.max(25, Math.min(95, Math.round(75 + savingsBonus - commitmentPenalty)));
    }
  }

  // 2. Extração do Status
  const healthStatus = normalizeHealthStatus(parsed?.healthStatus, healthScore);

  // 3. Extração do Parecer Executivo
  let executiveSummary = "";
  if (parsed && typeof parsed.executiveSummary === "string") {
    executiveSummary = sanitizeText(parsed.executiveSummary);
  }
  if (!executiveSummary) {
    const matchSummary = rawText.match(/"executiveSummary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
    if (matchSummary) {
      executiveSummary = sanitizeText(matchSummary[1]);
    }
  }
  if (!executiveSummary || executiveSummary.startsWith("{")) {
    const netFormatted = context.cashflow.netCashflow >= 0 ? "positivo" : "negativo";
    const statusWord = healthStatus === "critical" ? "requer atenção prioritária" : "está equilibrado";

    executiveSummary = `Olá! Analisei todo o seu fluxo deste mês. Seu saldo em conta fechou ${netFormatted}, mas o comprometimento total com cartões e despesas fixas ${statusWord}. Estou acompanhando cada movimentação de perto para sugerir passos simples que mantenham sua estabilidade e acelerem suas metas.`;
  }

  // 4. Normalização de Padrões de Consumo
  const spendingPatterns: SpendingPatternItem[] = [];
  const rawPatterns = parsed?.spendingPatterns;
  if (Array.isArray(rawPatterns)) {
    for (const p of rawPatterns) {
      if (typeof p === "string") {
        spendingPatterns.push({
          title: "Padrão Identificado",
          description: sanitizeText(p),
          type: "info",
        });
      } else if (p && typeof p === "object") {
        const item = p as Record<string, unknown>;
        spendingPatterns.push({
          title: String(item.title || "Comportamento de Consumo"),
          description: sanitizeText(item.description || item.detalhe || ""),
          type: (item.type as "info" | "warning" | "alert") || "info",
        });
      }
    }
  } else if (typeof rawPatterns === "string" && rawPatterns.trim()) {
    spendingPatterns.push({
      title: "Análise de Gastos",
      description: sanitizeText(rawPatterns),
      type: "info",
    });
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

  // 7. Normalização de Alertas de Gastos Específicos (ex: iFood, Uber, etc.)
  const specificExpensesAlerts: SpecificExpenseAlert[] = [];
  const rawSpecific = parsed?.specificExpensesAlerts;
  if (Array.isArray(rawSpecific) && rawSpecific.length > 0) {
    for (const item of rawSpecific) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        specificExpensesAlerts.push({
          item: String(obj.item || "Gasto Frequente"),
          totalAmount: typeof obj.totalAmount === "number" ? obj.totalAmount : 0,
          count: typeof obj.count === "number" ? obj.count : undefined,
          alertType: (obj.alertType as "info" | "warning" | "alert") || "info",
          message: sanitizeText(obj.message || ""),
        });
      }
    }
  }

  // Se a IA não preencheu, deriva deterministicamente dos topSpendItems
  if (specificExpensesAlerts.length === 0 && context.topSpendItems?.length) {
    for (const item of context.topSpendItems.slice(0, 4)) {
      const isHigh = item.percentage >= 10 || item.total > 200;
      specificExpensesAlerts.push({
        item: item.title,
        totalAmount: item.total,
        count: item.count,
        alertType: isHigh ? "warning" : "info",
        message: `Você gastou R$ ${item.total.toFixed(2)} em ${item.count} compra(s) (${item.percentage}% do total gasto em ${item.category}).`,
      });
    }
  }

  // 8. Normalização da Janela de Liquidez (Hoje vs Mês Que Vem)
  const liq = context.liquidityAnalysis;
  const rawCashflow = parsed?.cashflowWindow as Record<string, unknown> | undefined;
  const rawCurrent = rawCashflow?.currentMonth as Record<string, unknown> | undefined;
  const rawNext = rawCashflow?.nextMonth as Record<string, unknown> | undefined;

  const cashflowWindow: CashflowWindowSummary = {
    currentMonth: {
      monthName: liq.currentMonth.monthName,
      checkingBalance: liq.currentMonth.checkingBalance,
      pendingBills: liq.currentMonth.pendingBills,
      projectedFreeBalance: liq.currentMonth.projectedFreeBalance,
      insight:
        typeof rawCurrent?.insight === "string" && rawCurrent.insight.trim()
          ? sanitizeText(rawCurrent.insight)
          : liq.currentMonth.projectedFreeBalance >= 0
          ? `Você tem R$ ${liq.currentMonth.projectedFreeBalance.toFixed(2)} livres na conta para terminar o mês atual com tranquilidade.`
          : `Atenção: as saídas deste mês superam o saldo em conta em R$ ${Math.abs(liq.currentMonth.projectedFreeBalance).toFixed(2)}.`,
    },
    nextMonth: {
      monthName: liq.nextMonth.monthName,
      projectedIncome: liq.nextMonth.projectedIncome,
      committedExpenses: liq.nextMonth.committedExpenses,
      cardInstallments: liq.nextMonth.cardInstallments,
      recurringDebit: liq.nextMonth.recurringDebit,
      projectedFreeBalance: liq.nextMonth.projectedFreeBalance,
      insight:
        typeof rawNext?.insight === "string" && rawNext.insight.trim()
          ? sanitizeText(rawNext.insight)
          : liq.nextMonth.projectedFreeBalance >= 0
          ? `Mês que vem você terá R$ ${liq.nextMonth.projectedFreeBalance.toFixed(2)} livres para gastar após quitar despesas fixas e parcelas.`
          : `Mês que vem exigirá cautela: os compromissos previstos superam a renda projetada em R$ ${Math.abs(liq.nextMonth.projectedFreeBalance).toFixed(2)}.`,
    },
  };

  // 9. Normalização do Cronograma de Parcelamentos
  const installmentSchedule: InstallmentScheduleItem[] = [];
  const rawSchedule = parsed?.installmentSchedule;
  if (Array.isArray(rawSchedule) && rawSchedule.length > 0) {
    for (const item of rawSchedule) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        installmentSchedule.push({
          period: String(obj.period || "Próximo Ciclo"),
          dueDateHint: obj.dueDateHint ? String(obj.dueDateHint) : undefined,
          cardInstallmentsAmount: typeof obj.cardInstallmentsAmount === "number" ? obj.cardInstallmentsAmount : 0,
          status: (obj.status as "safe" | "warning" | "alert") || "safe",
          explanation: sanitizeText(obj.explanation || ""),
        });
      }
    }
  }

  if (installmentSchedule.length === 0 && context.monthlyProjections?.length) {
    for (const p of context.monthlyProjections.slice(1, 4)) {
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
  const clientProfileAssessment: ClientProfileAssessment = {
    persona:
      typeof rawProfileAssessment?.persona === "string" && rawProfileAssessment.persona.trim()
        ? sanitizeText(rawProfileAssessment.persona)
        : personaLabels[context.profile.persona] || "Otimizador",
    riskTolerance:
      typeof rawProfileAssessment?.riskTolerance === "string" && rawProfileAssessment.riskTolerance.trim()
        ? sanitizeText(rawProfileAssessment.riskTolerance)
        : riskLabels[context.profile.riskTolerance] || "Moderada",
    monthlyIncomeBase: context.profile.monthlyIncomeBase,
    primaryFocus: context.profile.primaryFocus || "Equilíbrio financeiro e metas",
    commitmentLimitPercent: context.profile.maxCommitmentAlertPercent,
    profileAlignmentInsight:
      typeof rawProfileAssessment?.profileAlignmentInsight === "string" && rawProfileAssessment.profileAlignmentInsight.trim()
        ? sanitizeText(rawProfileAssessment.profileAlignmentInsight)
        : `Com renda base de R$ ${context.profile.monthlyIncomeBase.toFixed(2)} e foco em "${context.profile.primaryFocus}", seus compromissos fixos e faturas absorvem ${context.commitments.commitmentRatioPercent}% do seu orçamento mensal.`,
    recommendedActionForGoal:
      typeof rawProfileAssessment?.recommendedActionForGoal === "string" && rawProfileAssessment.recommendedActionForGoal.trim()
        ? sanitizeText(rawProfileAssessment.recommendedActionForGoal)
        : undefined,
  };

  // 11. Reality Check para Meses Futuros (Ponderação de Gastos Variáveis)
  const rawReality = parsed?.futureMonthsRealityCheck as Record<string, unknown> | undefined;
  const historicalBaseline = context.historicalVariableBaseline || 0;
  const futureMonthsRealityCheck: FutureMonthsRealityCheck = {
    historicalVariableBaseline: historicalBaseline,
    realityNote:
      typeof rawReality?.realityNote === "string" && rawReality.realityNote.trim()
        ? sanitizeText(rawReality.realityNote)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userProfile,
      cards = [],
      transactions = [],
      recurringItems = [],
      goals = [],
      mainBalance = 0,
      monthIncome = 0,
      monthExpense = 0,
      monthlyProjections = [],
    } = body;

    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards,
      transactions,
      recurringItems,
      goals,
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections,
    });
    const safeContext = createSafeFinancialContext(telemetry);

    const systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    const userPrompt = `Realize o DIAGNÓSTICO FINANCEIRO EXECUTIVO do usuário para apresentar no painel do aplicativo.

POSTURA DO ANALISTA (CFO PESSOAL):
- Atue como um ANALISTA FINANCEIRO PESSOAL trabalhando lado a lado com o usuário: objetivo, direto, cirúrgico e focado em números e hábitos reais.
- MENOS TEXTINHO E SEM BLÁ BLÁ BLÁ: Elimine introduções vazias, saudações clichês e parágrafos longos de autoajuda. Vá direto aos números e às conclusões práticas com valores em negrito.
- O "executiveSummary" deve ter no MÁXIMO 3 frases assertivas:
  1) Veredito da conta no mês atual: Entradas vs Saídas em conta e a sobra líquida real obtida.
  2) Impacto no mês seguinte: Fatura acumulada no cartão de crédito e quanto consumirá da renda no próximo vencimento.
  3) Principal padrão de atenção ou ralo financeiro identificado.

DIRETRIZES FUNDAMENTAIS DO DIAGNÓSTICO:
1. GASTOS ESPECÍFICOS & PADRÕES DE CONSUMO (ANALISTA AUTODIDATA):
   - Inspecione a lista de estabelecimentos, fornecedores e lançamentos reais.
   - Preencha 'specificExpensesAlerts' destacando os estabelecimentos e despesas frequentes com nome exato, valor total acumulado e contagem de compras.
   - Não invente nem fique preso a marcas fixas: use os dados reais do extrato.
2. REGRA CONTÁBIL DE CAIXA vs CARTÃO:
   - Mês atual: analise o fluxo de caixa em conta (entradas - saídas em débito/PIX = sobra real).
   - Cartão de crédito: trate como compromisso que impacta APENAS NO MÊS SEGUINTE (quando a fatura é paga).
   - Preencha 'cashflowWindow' com insights diretos e números claros.
3. REALITY CHECK PARA MESES FUTUROS (Ex: Dezembro / Projeções):
   - Considere que o livro-caixa registra apenas parcelas e fixas agendadas. O usuário naturalmente continuará tendo gastos variáveis do dia a dia (baseline de ~R$ ${safeContext.historicalVariableBaseline.toFixed(2)}/mês).
   - Preencha 'futureMonthsRealityCheck' alertando de forma madura que a sobra real será menor que a sobra bruta nominal, sem tratar isso como verdade absoluta inflexível.
4. PERFIL DO CLIENTE & ALINHAMENTO:
   - Avalie o alinhamento entre a renda mensal base (R$ ${safeContext.profile.monthlyIncomeBase.toFixed(2)}), a persona (${safeContext.profile.persona}), o risco (${safeContext.profile.riskTolerance}) e a meta principal ("${safeContext.profile.primaryFocus}").
   - Preencha 'clientProfileAssessment'.
5. PARCELAS DILUÍDAS: Em 'installmentSchedule', mostre que parcelamentos futuros são normais se o saldo livre de cada mês se mantiver positivo.

RESPONDA ESTRITAMENTE EM FORMATO JSON com a seguinte estrutura:
{
  "healthScore": number, // pontuação inteira de 0 a 100
  "healthStatus": "excellent" | "healthy" | "attention" | "critical",
  "executiveSummary": "texto executivo direto do analista (máx 3 frases assertivas com valores)",
  "spendingPatterns": [
    {
      "title": "título curto do padrão",
      "description": "análise direta do padrão em uma frase com valores",
      "type": "info" | "warning" | "alert"
    }
  ],
  "specificExpensesAlerts": [
    {
      "item": "nome do estabelecimento ou hábito identificado",
      "totalAmount": 420.00,
      "count": 6,
      "alertType": "info" | "warning" | "alert",
      "message": "ex: Foram identificadas 6 compras em [Estabelecimento] totalizando R$ 420,00 este mês."
    }
  ],
  "cashflowWindow": {
    "currentMonth": {
      "insight": "insight direto sobre a sobra líquida em conta deste mês"
    },
    "nextMonth": {
      "insight": "insight claro sobre a fatura do cartão e o saldo livre projetado mês que vem"
    }
  },
  "installmentSchedule": [
    {
      "period": "ex: Outubro/2026",
      "dueDateHint": "Vencimento em torno do dia 15",
      "cardInstallmentsAmount": 500.00,
      "status": "safe" | "warning" | "alert",
      "explanation": "explicação de que a parcela está distribuída no mês sem aperto"
    }
  ],
  "futureMonthsRealityCheck": {
    "realityNote": "orientação realista preventiva sobre gastos variáveis do dia a dia em meses futuros como Dezembro"
  },
  "clientProfileAssessment": {
    "profileAlignmentInsight": "como os gastos e fluxo atuais conversam com a renda base, arquétipo e meta do cliente",
    "recommendedActionForGoal": "ação tática para acelerar a meta principal"
  },
  "futureProjections": [
    {
      "period": "ex: Outubro/2026 ou Próximos 30 dias",
      "description": "previsão contábil do mês com base no saldo livre projetado, alertando se fecha no azul ou no vermelho",
      "severity": "info" | "warning" | "alert"
    }
  ],
  "actionableSuggestions": [
    {
      "title": "título da melhoria recomendada",
      "action": "ação tática prática e sem rodeios com valor estimado",
      "potentialGain": "ganho ou economia estimada (ex: R$ 200/mês)",
      "targetGoal": "meta beneficiada se houver"
    }
  ]
}

IMPORTANTE: Responda APENAS o JSON válido. Não coloque texto antes ou depois. Nunca use aspas duplas dentro dos valores de texto.`;

    const response = await callGeminiCascade({
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.25,
      jsonMode: true,
      maxOutputTokens: 3500,
    });

    const parsedDiagnosis = safeParseFinancialDiagnosis(response.text, safeContext);
    const sanitizedDiagnosis = JSON.parse(JSON.stringify(parsedDiagnosis));

    return NextResponse.json({
      success: true,
      diagnosis: sanitizedDiagnosis,
      modelUsed: response.modelUsed,
      durationMs: response.durationMs,
      attemptedModels: response.attemptedModels,
    });
  } catch {
    console.error("[AI_ANALYZE_ERROR]", { errorCode: "AI_ANALYZE_FAILED" });
    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível concluir a análise financeira no momento.",
      },
      { status: 500 }
    );
  }
}
