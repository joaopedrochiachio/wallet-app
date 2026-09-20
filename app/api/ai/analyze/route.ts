import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  buildFinancialAnalystSystemPrompt,
} from "@/lib/services/financialContextService";

export interface FinancialDiagnosis {
  healthScore: number;
  healthStatus: "excellent" | "healthy" | "attention" | "critical";
  executiveSummary: string;
  spendingPatterns: Array<{
    title: string;
    description: string;
    type: "info" | "warning" | "alert";
  }>;
  futureProjections: Array<{
    period: string;
    description: string;
    severity: "info" | "warning" | "alert";
  }>;
  actionableSuggestions: Array<{
    title: string;
    action: string;
    potentialGain?: string;
    targetGoal?: string;
  }>;
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

    const systemPrompt = buildFinancialAnalystSystemPrompt(telemetry);

    const userPrompt = `Realize um DIAGNÓSTICO FINANCEIRO EXECUTIVO completo dos dados acima.
Você deve responder ESTRITAMENTE em formato JSON com a seguinte estrutura schema:
{
  "healthScore": number, // pontuação de 0 a 100 baseada na solidez, reservas, compromissos e dívidas
  "healthStatus": "excellent" | "healthy" | "attention" | "critical",
  "executiveSummary": "string concisa com o parecer geral do analista sobre a situação atual",
  "spendingPatterns": [
    {
      "title": "string curta do padrão detectado",
      "description": "análise detalhada de onde o dinheiro está vazando ou como se comporta",
      "type": "info" | "warning" | "alert"
    }
  ],
  "futureProjections": [
    {
      "period": "ex: Próximo Mês / 60 dias",
      "description": "projeção dos grupos de gastos futuros, impacto das faturas e parcelas a vencer",
      "severity": "info" | "warning" | "alert"
    }
  ],
  "actionableSuggestions": [
    {
      "title": "string título da melhoria recomendada",
      "action": "passo prático e objetivo que o usuário deve executar",
      "potentialGain": "estimativa numérica de economia ou ganho (ex: R$ 250/mês)",
      "targetGoal": "nome da meta beneficiada ou equilíbrio geral"
    }
  ]
}

Responda APENAS o JSON válido, sem texto introdutório ou markdown ao redor do JSON.`;

    const response = await callGeminiCascade({
      systemPrompt,
      prompt: userPrompt,
      temperature: 0.2,
      jsonMode: true,
      maxOutputTokens: 2500,
    });

    let parsedDiagnosis: FinancialDiagnosis;
    try {
      // Tenta parse direto ou extração de bloco json
      let cleanText = response.text.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s*/, "").replace(/```\s*$/, "");
      } else if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```\s*/, "").replace(/```\s*$/, "");
      }
      parsedDiagnosis = JSON.parse(cleanText);
    } catch {
      // Fallback estruturado caso o modelo tenha retornado formato alternativo
      parsedDiagnosis = {
        healthScore: 78,
        healthStatus: "healthy",
        executiveSummary: response.text.slice(0, 300),
        spendingPatterns: [
          {
            title: "Padrão de Gastos Gerais",
            description: "Análise processada pelo modelo de inteligência financeira.",
            type: "info",
          },
        ],
        futureProjections: [
          {
            period: "Próximos 30 dias",
            description: "Fluxo sob monitoramento contínuo.",
            severity: "info",
          },
        ],
        actionableSuggestions: [
          {
            title: "Revisão Periódica",
            action: "Mantenha o registro frequente das transações.",
            potentialGain: "Visibilidade total do caixa",
          },
        ],
      };
    }

    return NextResponse.json({
      success: true,
      diagnosis: parsedDiagnosis,
      modelUsed: response.modelUsed,
      durationMs: response.durationMs,
      attemptedModels: response.attemptedModels,
    });
  } catch (error: unknown) {
    console.error("[API AI Analyze Error]:", error);
    const message = error instanceof Error ? error.message : "Erro interno no processamento de IA";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
