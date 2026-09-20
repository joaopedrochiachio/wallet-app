import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  buildFinancialAnalystSystemPrompt,
  SafeFinancialContext,
} from "@/lib/services/financialContextService";

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

export interface FinancialDiagnosis {
  healthScore: number;
  healthStatus: "excellent" | "healthy" | "attention" | "critical";
  executiveSummary: string;
  spendingPatterns: SpendingPatternItem[];
  futureProjections: FutureProjectionItem[];
  actionableSuggestions: ActionableSuggestionItem[];
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

  return {
    healthScore,
    healthStatus,
    executiveSummary,
    spendingPatterns,
    futureProjections,
    actionableSuggestions,
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
    });
    const safeContext = createSafeFinancialContext(telemetry);

    const systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    const userPrompt = `Realize o DIAGNÓSTICO FINANCEIRO do usuário para apresentar no painel do aplicativo.

DIRETRIZES DE TOM:
- Use padrão formal, porém INTUITIVO, NATURAL e CONVERSACIONAL, como um assistente financeiro pessoal de confiança.
- Apresente conclusões simples e claras a partir dos dados cruzados, sem usar termos técnicos frios.
- O "executiveSummary" deve conversar diretamente com o usuário em primeira pessoa ("Olá! Analisei suas contas..."), acolhendo os acertos e alertando sobre pontos de atenção com empatia.

RESPONDA ESTRITAMENTE EM FORMATO JSON com a seguinte estrutura:
{
  "healthScore": number, // pontuação inteira de 0 a 100
  "healthStatus": "excellent" | "healthy" | "attention" | "critical",
  "executiveSummary": "texto natural e acolhedor do assistente avaliando o momento atual",
  "spendingPatterns": [
    {
      "title": "título curto do padrão",
      "description": "explicação simples em linguagem natural",
      "type": "info" | "warning" | "alert"
    }
  ],
  "futureProjections": [
    {
      "period": "ex: Próximos 30 dias / Vencimentos",
      "description": "previsão de faturas e compromissos futuros explicados de forma simples",
      "severity": "info" | "warning" | "alert"
    }
  ],
  "actionableSuggestions": [
    {
      "title": "título da melhoria recomendada",
      "action": "passo prático e objetivo explicado com clareza",
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

    return NextResponse.json({
      success: true,
      diagnosis: parsedDiagnosis,
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
