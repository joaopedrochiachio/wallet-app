import { NextRequest, NextResponse } from "next/server";
import { callGeminiCascade } from "@/lib/services/geminiService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  isExcludedFromHabitAnalysis,
  inferHabitCategory,
} from "@/lib/services/financialContextService";
import { SpecificExpenseAlert } from "@/app/api/ai/analyze/route";
import { verifyServerAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/utils/rateLimiter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Cascata otimizada com modelos mais rápidos e baratos para extração de padrões
const FAST_PATTERNS_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

function isDismissedPattern(
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

function sanitizeText(str: string): string {
  if (!str) return "";
  const clean = str.replace(/<[^>]*>?/gm, "").trim();
  return clean.replace(/\\"/g, '"').replace(/\\n/g, "\n");
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }

    // Rate Limiting (máx 10 solicitações de padrões por minuto por usuário)
    const rateLimit = checkRateLimit(`ai-patterns:${authResult.user.uid}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas consultas em sequência. Aguarde ${rateLimit.retryAfterSec} segundos antes de buscar novos padrões.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSec),
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await req.json();
    const {
      userProfile,
      cards = [],
      transactions = [],
      recurringItems = [],
      dismissedPatterns = [],
    } = body;

    const safeCards = Array.isArray(cards) ? cards.slice(0, 30) : [];
    const safeTransactions = Array.isArray(transactions) ? transactions.slice(0, 300) : [];
    const safeRecurring = Array.isArray(recurringItems) ? recurringItems.slice(0, 50) : [];
    const safeDismissed = Array.isArray(dismissedPatterns)
      ? dismissedPatterns.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards: safeCards,
      transactions: safeTransactions,
      recurringItems: safeRecurring,
      goals: [],
      mainBalance: 0,
      monthIncome: 0,
      monthExpense: 0,
    });
    const safeContext = createSafeFinancialContext(telemetry);

    // Candidatos pré-computados com repetição real (count >= 2) e não descartados
    const availableSpends = (safeContext.topSpendItems || []).filter(
      (item) =>
        !isExcludedFromHabitAnalysis(item.title, item.category) &&
        item.count >= 2 &&
        !isDismissedPattern(item.title, item.habitCategory, safeDismissed)
    );

    const availableHabits = (safeContext.lifestyleHabits || []).filter(
      (h) =>
        !isExcludedFromHabitAnalysis(h.habitName) &&
        h.habitName !== "Alimentação Geral" &&
        h.habitName !== "Outros Hábitos" &&
        h.count >= 2 &&
        !isDismissedPattern(h.habitName, undefined, safeDismissed)
    );

    const systemPrompt = `Você é um Analista de Inteligência Financeira e Detecção de Hábitos de Consumo.
Sua única responsabilidade é identificar PADRÕES DE CONSUMO e HÁBITOS DE ESTILO DE VIDA repetitivos nos lançamentos do usuário.

REGRAS RÍGIDAS DE ELEGIBILIDADE:
1. REPETIÇÃO OBRIGATÓRIA (count >= 2):
   - Um padrão EXIGE no MÍNIMO 2 compras reais no mesmo estabelecimento ou mesmo tipo de gasto.
   - NUNCA reporte compras isoladas (1 compra), cursos/mensalidades (ex: "Inglês"), notas manuais com múltiplas despesas somadas (ex: "Gastos (Inatel...)").
2. NÃO CONFUNDA TRANSAÇÕES BANCÁRIAS/AJUSTES COM HÁBITOS:
   - Faturas de cartão de crédito ("Fatura Santander", "Fatura Nubank"), ajustes de saldo, transferências e rifas/sorteios NUNCA são hábitos de consumo. É ESTRITAMENTE PROIBIDO incluí-los.
3. PADRONIZAÇÃO COMPORTAMENTAL:
   - Identifique categorias como: "Sobremesas & Doces" (sorvete, docerias, Chiquinho), "Lanches & Fast Food" (McDonald's, hamburguerias, pipoca), "Cafés & Cantinas", "Restaurantes & Delivery" (iFood, almoço), "Telefonia & Internet" (Vivo Easy, recargas), "Transporte & Mobilidade" (Uber, 99, combustível).
   - "Vivo Easy" é 'Telefonia & Internet', NUNCA delivery nem restaurantes.
4. PADRÕES DESCARTADOS PELO USUÁRIO:
   ${safeDismissed.length > 0 ? `- O usuário descartou os seguintes padrões: ${JSON.stringify(safeDismissed)}. NÃO gere nenhum alerta para estes itens.` : "- Nenhum padrão descartado previamente."}
5. ZERO ALUCINAÇÃO:
   - Se os lançamentos não mostrarem padrões repetitivos elegíveis, retorne {"patterns": []}. Não invente dados fictícios.`;

    const userPrompt = `Identifique padrões e hábitos de consumo recorrentes com base nos seguintes dados consolidados:

CANDIDATOS RECORRENTES IDENTIFICADOS NO CAIXA:
${JSON.stringify(
  {
    topSpendItems: availableSpends,
    lifestyleHabits: availableHabits,
    recentExpenses: safeContext.recentExpenses.slice(0, 10),
  },
  null,
  2
)}

RESPONDA ESTRITAMENTE EM JSON no formato:
{
  "patterns": [
    {
      "item": "Nome do hábito ou estabelecimento (ex: Sobremesas & Doces ou McDonald's)",
      "habitCategory": "Categoria padronizada",
      "totalAmount": 120.50,
      "count": 3,
      "creditAmount": 80.00,
      "debitAmount": 40.50,
      "paymentBreakdown": "Crédito: R$ 80,00 | Débito: R$ 40,50",
      "alertType": "info" | "warning" | "alert",
      "message": "Você realizou 3 compras em ... somando R$ 120,50 (sendo R$ 80,00 no crédito e R$ 40,50 no débito)."
    }
  ]
}

IMPORTANTE: Apenas JSON válido sem texto adicional. Se não houver padrões com count >= 2, retorne "patterns": [].`;

    const response = await callGeminiCascade({
      systemPrompt,
      prompt: userPrompt,
      models: FAST_PATTERNS_MODELS,
      temperature: 0.2,
      jsonMode: true,
      maxOutputTokens: 1500,
      timeoutMs: 20000,
    });

    let candidate = response.text.trim();
    if (candidate.startsWith("```json")) {
      candidate = candidate.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    } else if (candidate.startsWith("```")) {
      candidate = candidate.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    }

    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidate = candidate.slice(firstBrace, lastBrace + 1);
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      console.warn("[AI_PATTERNS_PARSE_FAILED]", { errorCode: "INVALID_MODEL_JSON" });
    }

    const patterns: SpecificExpenseAlert[] = [];
    const rawPatterns = parsed?.patterns || parsed?.specificExpensesAlerts || parsed?.gastosEspecificos;

    if (Array.isArray(rawPatterns)) {
      for (const item of rawPatterns) {
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const rawItemName = String(obj.item || "").trim();
          if (!rawItemName) continue;

          // 1. Exclui transações operacionais, faturas e rifas
          if (isExcludedFromHabitAnalysis(rawItemName)) continue;

          const count = typeof obj.count === "number" ? obj.count : undefined;
          // Padrão de consumo exige repetição real (mínimo de 2 compras)
          if (count !== undefined && count < 2) continue;
          if (/\(1\s*compra\)/i.test(rawItemName)) continue;

          const refinedHabit = inferHabitCategory(rawItemName, String(obj.habitCategory || ""));
          const habitCategory =
            refinedHabit && refinedHabit !== "Outros Hábitos" && refinedHabit !== "Alimentação Geral"
              ? refinedHabit
              : typeof obj.habitCategory === "string" && obj.habitCategory.trim()
              ? sanitizeText(obj.habitCategory)
              : undefined;

          // Exclui padrões descartados
          if (isDismissedPattern(rawItemName, habitCategory, safeDismissed)) continue;

          const totalAmount = typeof obj.totalAmount === "number" ? obj.totalAmount : 0;
          const creditAmount = typeof obj.creditAmount === "number" ? obj.creditAmount : undefined;
          const debitAmount = typeof obj.debitAmount === "number" ? obj.debitAmount : undefined;

          let paymentBreakdown =
            typeof obj.paymentBreakdown === "string" && obj.paymentBreakdown.trim()
              ? sanitizeText(obj.paymentBreakdown)
              : undefined;

          if (!paymentBreakdown && (creditAmount !== undefined || debitAmount !== undefined)) {
            const c = creditAmount ?? 0;
            const d = debitAmount ?? 0;
            if (c > 0 && d > 0) {
              paymentBreakdown = `Crédito: R$ ${c.toFixed(2)} | Débito: R$ ${d.toFixed(2)}`;
            } else if (c > 0) {
              paymentBreakdown = `100% no Crédito (R$ ${c.toFixed(2)})`;
            } else if (d > 0) {
              paymentBreakdown = `100% no Débito/PIX (R$ ${d.toFixed(2)})`;
            }
          }

          patterns.push({
            item: rawItemName,
            totalAmount,
            count,
            creditAmount,
            debitAmount,
            paymentBreakdown,
            habitCategory,
            alertType: (obj.alertType as "info" | "warning" | "alert") || "info",
            message: sanitizeText(String(obj.message || "")),
          });
        }
      }
    }

    // Se o modelo não encontrou novos padrões além do que já calculamos no motor determinístico,
    // aproveitamos os topSpends recorrentes disponíveis como complemento
    if (patterns.length === 0 && availableSpends.length > 0) {
      for (const item of availableSpends.slice(0, 3)) {
        const isHigh = item.percentage >= 10 || item.total > 150;
        patterns.push({
          item: item.title,
          totalAmount: item.total,
          count: item.count,
          creditAmount: item.creditAmount,
          debitAmount: item.debitAmount,
          paymentBreakdown: item.paymentBreakdown,
          habitCategory: item.habitCategory,
          alertType: isHigh ? "warning" : "info",
          message: `Identificamos ${item.count} compra(s) em ${item.title} somando R$ ${item.total.toFixed(2)} (${item.paymentBreakdown || "À vista"}).`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      patterns,
      modelUsed: response.modelUsed,
      durationMs: response.durationMs,
    });
  } catch {
    console.error("[AI_PATTERNS_ERROR]", { errorCode: "AI_PATTERNS_FAILED" });
    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível buscar padrões adicionais no momento.",
      },
      { status: 500 }
    );
  }
}
