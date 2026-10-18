import { NextRequest, NextResponse } from "next/server.js";
import { orchestrateFinancialDiagnosis } from "../../../../lib/services/agentManagerService.ts";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
  buildFinancialAnalystSystemPrompt,
} from "../../../../lib/services/financialContextService.ts";
import { verifyServerAuth } from "../../../../lib/auth/serverAuth.ts";
import {
  reserveAIQuota,
  reconcileAIQuota,
  recordAICallLog,
} from "../../../../lib/services/aiUsageService.ts";
import { checkRateLimit } from "../../../../lib/utils/rateLimiter.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB

export * from "../../../../lib/services/financialDiagnosisService.ts";

export async function POST(req: NextRequest) {
  try {
    // 1. Verificação de tamanho máximo de payload (proteção anti-DoS)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "Tamanho da requisição excede o limite máximo permitido." },
        { status: 413 }
      );
    }

    // 2. Autenticação estrita do servidor: identifica o usuário exclusivamente pelo token assinado
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const userId = authResult.user.uid;

    // 3. Rate limiting contra rajadas (burst protection: máx 5 análises por minuto por usuário)
    const burstCheck = checkRateLimit(`ai-analyze-burst:${userId}`, 5, 60000);
    if (!burstCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas solicitações de análise em sequência. Aguarde ${burstCheck.retryAfterSec} segundos.`,
          code: "BURST_LIMIT_EXCEEDED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(burstCheck.retryAfterSec),
            "X-RateLimit-Limit": String(burstCheck.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 4. Extração e validação do corpo da requisição ANTES de criar reserva de cota
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
      dismissedPatterns = [],
      targetEndMonthBalance,
    } = body;

    // Proteção de sobrecarga: limita o tamanho dos arrays processados
    const safeCards = Array.isArray(cards) ? cards.slice(0, 30) : [];
    const safeTransactions = Array.isArray(transactions) ? transactions.slice(0, 300) : [];
    const safeRecurring = Array.isArray(recurringItems) ? recurringItems.slice(0, 50) : [];
    const safeGoals = Array.isArray(goals) ? goals.slice(0, 30) : [];

    // 3. Cálculo determinístico em TypeScript antes de qualquer envio à IA
    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards: safeCards,
      transactions: safeTransactions,
      recurringItems: safeRecurring,
      goals: safeGoals,
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections,
      targetEndMonthBalance: typeof targetEndMonthBalance === "number" ? targetEndMonthBalance : undefined,
    });
    const safeContext = createSafeFinancialContext(telemetry);

    const systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    const safeDismissed = Array.isArray(dismissedPatterns)
      ? dismissedPatterns.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const userPrompt = `Realize o DIAGNÓSTICO FINANCEIRO EXECUTIVO do usuário para apresentar no painel do aplicativo.

POSTURA DO ANALISTA (CFO PESSOAL):
- Atue como um ANALISTA FINANCEIRO PESSOAL consultivo e encorajador: direto, objetivo, cirúrgico e focado em números reais e no cumprimento da meta do usuário.
- O "executiveSummary" deve ser conciso: 1 parágrafo curto com o panorama geral (Saldo Projetado de R$ ${safeContext.target.projectedEndMonthBalance.toFixed(2)} vs Meta de fechar com R$ ${safeContext.target.targetEndMonthBalance.toFixed(2)} positivo) + 2 ou 3 tópicos práticos com os passos seguintes.
- Se o saldo projetado atinge a meta: parabenize e informe a margem segura de R$ ${safeContext.target.safeSpendingMargin.toFixed(2)} livre para gastar até o fim do mês.
- Se a meta estiver em risco: aponte com precisão o montante em falta (R$ ${safeContext.target.missingAmount.toFixed(2)}) e destaque os maiores vilões do orçamento recente (${safeContext.target.topCulprits.join(", ") || "gastos recentes"}).
- NUNCA invente tetos de gastos arbitrários nem limites por categoria que não tenham sido explicitamente configurados pelo usuário.

DIRETRIZES FUNDAMENTAIS DO DIAGNÓSTICO:
1. GASTOS ESPECÍFICOS & HÁBITOS DE CONSUMO (CRÉDITO vs DÉBITO):
   - Um padrão de consumo EXIGE no MÍNIMO 2 compras reais no mesmo estabelecimento ou mesmo tipo de gasto (count >= 2).
   - NUNCA crie alertas para compras isoladas (1 compra), cursos/mensalidades esporádicas (ex: Inglês), notas manuais com múltiplas despesas somadas (ex: "Gastos (Inatel...)"), ajustes na conta ou faturas de cartão.
   - Se houver poucos ou nenhum padrão com repetição real, retorne a lista 'specificExpensesAlerts' VAZIA ([]). NÃO invente padrões.
   ${safeDismissed.length > 0 ? `* O usuário descartou os seguintes padrões no passado: ${JSON.stringify(safeDismissed)}. É PROIBIDO sugerir qualquer um deles novamente.` : ""}
2. REGRA CONTÁBIL DE CAIXA vs CARTÃO:
   - Mês atual: analise o fluxo de caixa em conta (entradas - saídas em débito/PIX = sobra real).
   - Cartão de crédito: trate como compromisso que impacta APENAS NO MÊS SEGUINTE.
3. REALITY CHECK PARA MESES FUTUROS:
   - Pondere que o livro-caixa registra apenas parcelas e fixas agendadas. O usuário naturalmente continuará tendo gastos variáveis do dia a dia (baseline de ~R$ ${safeContext.historicalVariableBaseline.toFixed(2)}/mês).
4. PERFIL DO CLIENTE & ALINHAMENTO:
   - Avalie o alinhamento entre a renda mensal base (R$ ${safeContext.profile.monthlyIncomeBase.toFixed(2)}), a persona (${safeContext.profile.persona}), o risco (${safeContext.profile.riskTolerance}) e a meta principal ("${safeContext.profile.primaryFocus}").
5. PARCELAS DILUÍDAS: Em 'installmentSchedule', mostre que parcelamentos futuros são normais se o saldo livre de cada mês se mantiver positivo.`;

    // 4. Reserva Atômica de Cota Persistente (máx 2 diagnósticos/dia e 10/mês por usuário)
    const quotaReservation = await reserveAIQuota({
      uid: userId,
      route: "analyze",
    });

    if (!quotaReservation.allowed || !quotaReservation.reservation) {
      const isConfigError = quotaReservation.errorCode === "MISSING_SERVICE_ACCOUNT";
      return NextResponse.json(
        {
          success: false,
          error: quotaReservation.error || "Limite de análises financeiras com IA atingido.",
          code: quotaReservation.errorCode || "AI_QUOTA_EXCEEDED",
        },
        {
          status: isConfigError ? 500 : 429,
          headers: quotaReservation.retryAfterSec
            ? { "Retry-After": String(quotaReservation.retryAfterSec) }
            : {},
        }
      );
    }

    const { reservation } = quotaReservation;
    let quotaReconciled = false;

    try {
      const response = await orchestrateFinancialDiagnosis({
        context: safeContext,
        systemPrompt,
        fullUserPrompt: userPrompt,
        dismissedPatterns: safeDismissed,
      });

      // 5. Reconciliação atômica da cota
      const actualCostUsd = response.openAIResponse?.estimatedCostUsd ?? (response.aiSynthesis ? 0.0015 : 0);
      await reconcileAIQuota({
        reservation,
        success: response.aiSynthesis,
        actualCostUsd,
      });
      quotaReconciled = true;

      // 6. Registro de observabilidade técnica
      if (response.openAIResponse) {
        void recordAICallLog({
          requestId: response.openAIResponse.requestId,
          uid: userId,
          route: "analyze",
          model: response.modelUsed,
          timestamp: new Date().toISOString(),
          durationMs: response.durationMs,
          success: response.aiSynthesis,
          inputTokens: response.openAIResponse.inputTokens,
          outputTokens: response.openAIResponse.outputTokens,
          reasoningTokens: response.openAIResponse.reasoningTokens,
          estimatedCostUsd: response.openAIResponse.estimatedCostUsd,
          isCostEstimated: response.openAIResponse.isCostEstimated,
        });
      }

      const sanitizedDiagnosis = JSON.parse(JSON.stringify(response.diagnosis));

      return NextResponse.json({
        success: true,
        diagnosis: sanitizedDiagnosis,
        modelUsed: response.modelUsed,
        durationMs: response.durationMs,
        attemptedModels: response.attemptedModels,
        aiSynthesis: response.aiSynthesis,
      });
    } catch (analysisErr: unknown) {
      if (!quotaReconciled) {
        await reconcileAIQuota({ reservation, success: false });
        quotaReconciled = true;
      }
      console.error("[AI_ANALYZE_ORCHESTRATION_ERROR]", analysisErr);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyErr = analysisErr as any;
      let errorMsg = "Não foi possível concluir a análise financeira no momento.";
      if (anyErr?.code === "MISSING_OPENAI_API_KEY") {
        errorMsg = "A chave OPENAI_API_KEY não está configurada no painel da Vercel.";
      } else if (anyErr?.message) {
        errorMsg = anyErr.message;
      }
      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          code: anyErr?.code || "ANALYZE_ERROR",
        },
        { status: anyErr?.status || 500 }
      );
    } finally {
      if (!quotaReconciled) {
        await reconcileAIQuota({ reservation, success: false });
      }
    }
  } catch (err: unknown) {
    console.error("[AI_ANALYZE_CRITICAL_ERROR]", err);
    return NextResponse.json(
      {
        success: false,
        error: "Não foi possível concluir o diagnóstico financeiro no momento. Tente novamente mais tarde.",
      },
      { status: 500 }
    );
  }
}
