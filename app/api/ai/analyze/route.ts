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

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export * from "../../../../lib/services/financialDiagnosisService.ts";

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação estrita do servidor: identifica o usuário exclusivamente pelo token assinado
    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) {
      return authResult.errorResponse;
    }
    const userId = authResult.user.uid;

    // 2. Extração e validação do corpo da requisição ANTES de criar reserva de cota
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
    });
    const safeContext = createSafeFinancialContext(telemetry);

    const systemPrompt = buildFinancialAnalystSystemPrompt(safeContext);

    const safeDismissed = Array.isArray(dismissedPatterns)
      ? dismissedPatterns.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const userPrompt = `Realize o DIAGNÓSTICO FINANCEIRO EXECUTIVO do usuário para apresentar no painel do aplicativo.

POSTURA DO ANALISTA (CFO PESSOAL):
- Atue como um ANALISTA FINANCEIRO PESSOAL: objetivo, direto, cirúrgico e focado em números e hábitos reais.
- O "executiveSummary" deve ter no MÁXIMO 3 frases assertivas:
  1) Veredito da conta no mês atual: Entradas vs Saídas em conta e a sobra líquida real obtida.
  2) Impacto no mês seguinte: Fatura acumulada no cartão de crédito e quanto consumirá da renda no próximo vencimento.
  3) Principal padrão de atenção ou ralo financeiro identificado.

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
      return NextResponse.json(
        {
          success: false,
          error: quotaReservation.error || "Limite de análises financeiras com IA atingido.",
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
    } catch (analysisErr) {
      if (!quotaReconciled) {
        await reconcileAIQuota({ reservation, success: false });
        quotaReconciled = true;
      }
      console.error("[AI_ANALYZE_ORCHESTRATION_ERROR]", analysisErr);
      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível concluir a análise financeira no momento.",
        },
        { status: 500 }
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
        error: "Erro inesperado ao gerar análise financeira.",
      },
      { status: 500 }
    );
  }
}
