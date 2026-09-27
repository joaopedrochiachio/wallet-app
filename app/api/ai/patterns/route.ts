import { NextRequest, NextResponse } from "next/server";
import { callOpenAIResponses } from "@/lib/services/openaiService";
import { SPENDING_PATTERNS_JSON_SCHEMA } from "@/lib/services/agentManagerService";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  isExcludedFromHabitAnalysis,
  inferHabitCategory,
} from "@/lib/services/financialContextService";
import { SpecificExpenseAlert } from "@/app/api/ai/analyze/route";
import { verifyServerAuth } from "@/lib/auth/serverAuth";
import {
  reserveAIQuota,
  reconcileAIQuota,
  recordAICallLog,
} from "@/lib/services/aiUsageService";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    // 1. Autenticação estrita do servidor
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const userId = authResult.user.uid;

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

    // 2. Cálculo determinístico em TypeScript antes de qualquer envio à IA
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

    // Se NÃO existirem transações elegíveis repetidas (count >= 2), não inventa padrões nem gasta tokens
    if (availableSpends.length === 0 && availableHabits.length === 0) {
      return NextResponse.json({
        success: true,
        patterns: [],
        modelUsed: "motor-contabil-local",
        durationMs: 0,
      });
    }

    // 3. Reserva Atômica de Cota Persistente (máx 4 buscas de padrões/dia e 20/mês)
    const quotaReservation = await reserveAIQuota({
      uid: userId,
      route: "patterns",
    });

    if (!quotaReservation.allowed || !quotaReservation.reservation) {
      return NextResponse.json(
        {
          success: false,
          error: quotaReservation.error || "Limite de busca de padrões adicionais atingido.",
          code: quotaReservation.errorCode || "AI_QUOTA_EXCEEDED",
        },
        {
          status: 429,
          headers: quotaReservation.retryAfterSec
            ? { "Retry-After": String(quotaReservation.retryAfterSec) }
            : {},
        }
      );
    }

    const { reservation } = quotaReservation;

    const systemPrompt = `Você é um Analista de Inteligência Financeira e Detecção de Hábitos de Consumo.
Sua responsabilidade é redigir explicações claras e empáticas sobre os padrões pré-computados fornecidos.

REGRAS RÍGIDAS DE ELEGIBILIDADE E INTEGRIDADE:
1. REPETIÇÃO OBRIGATÓRIA (count >= 2):
   - Nunca crie padrões para compras isoladas (1 compra), cursos/mensalidades (ex: "Inglês"), notas manuais com múltiplas despesas somadas.
2. TRANSAÇÕES OPERACIONAIS NUNCA SÃO HÁBITOS:
   - Faturas de cartão, transferências e rifas/sorteios não são hábitos de estilo de vida.
3. PADRÕES DESCARTADOS PELO USUÁRIO:
   ${safeDismissed.length > 0 ? `- O usuário descartou os seguintes padrões: ${JSON.stringify(safeDismissed)}. NÃO gere alertas para estes itens.` : "- Nenhum padrão descartado previamente."}
4. ZERO ALUCINAÇÃO:
   - Use estritamente os fatos e contagens fornecidos nos dados. Não altere valores nem contagens.`;

    const userPrompt = `Redija os alertas e mensagens para os seguintes candidatos de padrões reais apurados:
${JSON.stringify(
  {
    topSpendItems: availableSpends,
    lifestyleHabits: availableHabits,
  },
  null,
  2
)}`;

    try {
      const openAIResult = await callOpenAIResponses({
        systemPrompt,
        prompt: userPrompt,
        reasoningEffort: "none",
        maxOutputTokens: 1500,
        jsonSchema: SPENDING_PATTERNS_JSON_SCHEMA,
        timeoutMs: 20000,
      });

      // Reconciliação atômica da cota com base no consumo real
      await reconcileAIQuota({
        reservation,
        success: true,
        actualCostUsd: openAIResult.estimatedCostUsd,
      });

      // Registro de observabilidade
      void recordAICallLog({
        requestId: openAIResult.requestId,
        uid: userId,
        route: "patterns",
        model: openAIResult.modelUsed,
        timestamp: new Date().toISOString(),
        durationMs: openAIResult.durationMs,
        success: true,
        inputTokens: openAIResult.inputTokens,
        outputTokens: openAIResult.outputTokens,
        reasoningTokens: openAIResult.reasoningTokens,
        estimatedCostUsd: openAIResult.estimatedCostUsd,
        isCostEstimated: openAIResult.isCostEstimated,
      });

      // 4. Conferência rigorosa no servidor de cada contagem e valor retornado
      let parsed: { patterns?: unknown[] } | null = null;
      try {
        parsed = JSON.parse(openAIResult.text);
      } catch {
        console.warn("[AI_PATTERNS_PARSE_FAILED] Não foi possível parsear resposta do modelo.");
      }

      const patterns: SpecificExpenseAlert[] = [];
      const rawPatterns = parsed?.patterns;

      // Cria índice de busca rápida sobre os dados reais calculados localmente
      const realSpendsMap = new Map(
        availableSpends.map((s) => [s.title.toLowerCase().trim(), s])
      );
      const realHabitsMap = new Map(
        availableHabits.map((h) => [h.habitName.toLowerCase().trim(), h])
      );

      if (Array.isArray(rawPatterns)) {
        for (const item of rawPatterns) {
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            const rawItemName = String(obj.item || "").trim();
            if (!rawItemName) continue;

            if (isExcludedFromHabitAnalysis(rawItemName)) continue;

            // Busca correspondência nos dados reais para garantir zero alucinação
            const normName = rawItemName.toLowerCase().trim();
            const matchedSpend = realSpendsMap.get(normName) ||
              Array.from(realSpendsMap.values()).find((s) => s.title.toLowerCase().includes(normName) || normName.includes(s.title.toLowerCase()));
            const matchedHabit = realHabitsMap.get(normName) ||
              Array.from(realHabitsMap.values()).find((h) => h.habitName.toLowerCase().includes(normName) || normName.includes(h.habitName.toLowerCase()));

            // Se o modelo inventou um padrão que não existe nos dados reais, rejeita imediatamente!
            if (!matchedSpend && !matchedHabit) {
              continue;
            }

            // Garante contagem e valores reais extraídos da base
            const realCount = matchedSpend ? matchedSpend.count : matchedHabit!.count;
            if (realCount < 2) continue;

            const realTotal = matchedSpend ? matchedSpend.total : matchedHabit!.total;
            const realCredit = matchedSpend ? (matchedSpend.creditAmount ?? 0) : matchedHabit!.creditAmount;
            const realDebit = matchedSpend ? (matchedSpend.debitAmount ?? 0) : matchedHabit!.debitAmount;

            const refinedHabit = inferHabitCategory(
              rawItemName,
              String(obj.habitCategory || (matchedSpend ? matchedSpend.habitCategory : matchedHabit!.habitName))
            );
            const habitCategory =
              refinedHabit && refinedHabit !== "Outros Hábitos" && refinedHabit !== "Alimentação Geral"
                ? refinedHabit
                : undefined;

            if (isDismissedPattern(rawItemName, habitCategory, safeDismissed)) continue;

            let paymentBreakdown =
              typeof obj.paymentBreakdown === "string" && obj.paymentBreakdown.trim()
                ? sanitizeText(obj.paymentBreakdown)
                : undefined;

            if (!paymentBreakdown) {
              if (realCredit > 0 && realDebit > 0) {
                paymentBreakdown = `Crédito: R$ ${realCredit.toFixed(2)} | Débito: R$ ${realDebit.toFixed(2)}`;
              } else if (realCredit > 0) {
                paymentBreakdown = `100% no Crédito (R$ ${realCredit.toFixed(2)})`;
              } else {
                paymentBreakdown = `100% no Débito/PIX (R$ ${realDebit.toFixed(2)})`;
              }
            }

            patterns.push({
              item: matchedSpend ? matchedSpend.title : matchedHabit!.habitName,
              totalAmount: realTotal,
              count: realCount,
              creditAmount: realCredit,
              debitAmount: realDebit,
              paymentBreakdown,
              habitCategory,
              alertType: (obj.alertType as "info" | "warning" | "alert") || "info",
              message: sanitizeText(String(obj.message || "")) || `Identificamos ${realCount} compras totalizando R$ ${realTotal.toFixed(2)}.`,
            });
          }
        }
      }

      // Complementa com candidatos reais elegíveis não mencionados pela IA
      const isPatternAlreadyCovered = (name: string) => {
        const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return patterns.some((p) => {
          const pName = (p.item || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          return pName === norm || pName.includes(norm) || norm.includes(pName);
        });
      };

      for (const habit of availableHabits) {
        if (!isPatternAlreadyCovered(habit.habitName)) {
          const breakdown =
            habit.creditAmount > 0 && habit.debitAmount > 0
              ? `Crédito: R$ ${habit.creditAmount.toFixed(2)} | Débito: R$ ${habit.debitAmount.toFixed(2)}`
              : habit.creditAmount > 0
              ? `100% no Crédito (R$ ${habit.creditAmount.toFixed(2)})`
              : `100% no Débito/PIX (R$ ${habit.debitAmount.toFixed(2)})`;

          patterns.push({
            item: habit.habitName,
            totalAmount: habit.total,
            count: habit.count,
            creditAmount: habit.creditAmount,
            debitAmount: habit.debitAmount,
            paymentBreakdown: breakdown,
            habitCategory: habit.habitName,
            alertType: habit.total > 200 || habit.count >= 4 ? "warning" : "info",
            message: `Identificados ${habit.count} gastos com ${habit.habitName} somando R$ ${habit.total.toFixed(2)} (${breakdown}${habit.examples.length ? ` — ex: ${habit.examples.join(", ")}` : ""}).`,
          });
        }
      }

      for (const item of availableSpends) {
        if (!isPatternAlreadyCovered(item.title)) {
          patterns.push({
            item: item.title,
            totalAmount: item.total,
            count: item.count,
            creditAmount: item.creditAmount,
            debitAmount: item.debitAmount,
            paymentBreakdown: item.paymentBreakdown,
            habitCategory: item.habitCategory,
            alertType: item.percentage >= 10 || item.total > 150 ? "warning" : "info",
            message: `Identificamos ${item.count} compra(s) em ${item.title} somando R$ ${item.total.toFixed(2)} (${item.paymentBreakdown || "À vista"}).`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        patterns,
        modelUsed: openAIResult.modelUsed,
        durationMs: openAIResult.durationMs,
      });
    } catch {
      await reconcileAIQuota({ reservation, success: false });

      console.error("[AI_PATTERNS_ERROR]", { errorCode: "AI_PATTERNS_FAILED" });
      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível buscar padrões adicionais no momento.",
        },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[AI_PATTERNS_CRITICAL_ERROR]", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erro inesperado ao buscar padrões recorrentes.",
      },
      { status: 500 }
    );
  }
}
