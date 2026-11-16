import { NextRequest, NextResponse } from "next/server.js";
import {
  synthesizeFinancialTelemetry,
  createSafeFinancialContext,
} from "../../../../lib/services/financialContextService.ts";
import { generateAIBriefing, BriefingGenerationError } from "../../../../lib/services/aiBriefingService.ts";
import { describeProviderFailure } from "../../../../lib/services/aiFailure.ts";
import { verifyServerAuth } from "../../../../lib/auth/serverAuth.ts";
import { reserveAIQuota, reconcileAIQuota, recordAICallLog } from "../../../../lib/services/aiUsageService.ts";
import { checkRateLimit } from "../../../../lib/utils/rateLimiter.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const MAX_PAYLOAD_BYTES = 512 * 1024;

/** Mensagem honesta para cada falha: nunca devolvemos um informativo pronto no lugar da IA. */
function describeFailure(err: unknown): { status: number; error: string; code: string } {
  if (err instanceof BriefingGenerationError) return { status: 502, error: err.message, code: err.code };
  return describeProviderFailure(err);
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ success: false, error: "Tamanho da requisição excede o limite máximo permitido." }, { status: 413 });
    }

    const authResult = await verifyServerAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const userId = authResult.user.uid;

    const burst = checkRateLimit(`ai-briefing-burst:${userId}`, 5, 60000);
    if (!burst.allowed) {
      return NextResponse.json(
        { success: false, error: `Muitas atualizações seguidas. Aguarde ${burst.retryAfterSec} segundos.`, code: "BURST_LIMIT_EXCEEDED" },
        { status: 429, headers: { "Retry-After": String(burst.retryAfterSec) } }
      );
    }

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
      targetEndMonthBalance,
    } = body ?? {};

    const telemetry = synthesizeFinancialTelemetry({
      userProfile,
      cards: Array.isArray(cards) ? cards.slice(0, 30) : [],
      transactions: Array.isArray(transactions) ? transactions.slice(0, 300) : [],
      recurringItems: Array.isArray(recurringItems) ? recurringItems.slice(0, 50) : [],
      goals: Array.isArray(goals) ? goals.slice(0, 30) : [],
      mainBalance,
      monthIncome,
      monthExpense,
      monthlyProjections: Array.isArray(monthlyProjections) ? monthlyProjections.slice(0, 6) : [],
      targetEndMonthBalance: typeof targetEndMonthBalance === "number" ? targetEndMonthBalance : undefined,
    });
    const context = createSafeFinancialContext(telemetry);
    const incomeKnown = Number(userProfile?.monthlyIncomeBase) > 0 || Number(monthIncome) > 0;
    const firstName = typeof userProfile?.name === "string" ? userProfile.name.trim().split(/\s+/)[0]?.slice(0, 30) : undefined;

    const quota = await reserveAIQuota({ uid: userId, route: "analyze" });
    if (!quota.allowed || !quota.reservation) {
      const isConfigError = quota.errorCode === "MISSING_SERVICE_ACCOUNT";
      return NextResponse.json(
        { success: false, error: quota.error || "Limite de análises com IA atingido.", code: quota.errorCode || "AI_QUOTA_EXCEEDED" },
        { status: isConfigError ? 500 : 429, headers: quota.retryAfterSec ? { "Retry-After": String(quota.retryAfterSec) } : {} }
      );
    }

    const startedAt = Date.now();
    try {
      const result = await generateAIBriefing({ context, firstName, incomeKnown });
      const costUsd = result.openAIResponses.reduce((acc, r) => acc + (r.estimatedCostUsd || 0), 0);
      await reconcileAIQuota({ reservation: quota.reservation, success: true, actualCostUsd: costUsd });
      const last = result.openAIResponses[result.openAIResponses.length - 1];
      void recordAICallLog({
        requestId: last.requestId,
        uid: userId,
        route: "analyze",
        model: result.modelUsed,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        success: true,
        inputTokens: result.openAIResponses.reduce((a, r) => a + r.inputTokens, 0),
        outputTokens: result.openAIResponses.reduce((a, r) => a + r.outputTokens, 0),
        reasoningTokens: result.openAIResponses.reduce((a, r) => a + r.reasoningTokens, 0),
        estimatedCostUsd: costUsd,
        isCostEstimated: result.openAIResponses.some((r) => r.isCostEstimated),
      });

      return NextResponse.json({
        success: true,
        briefing: result.briefing,
        facts: result.facts,
        modelUsed: result.modelUsed,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      await reconcileAIQuota({ reservation: quota.reservation, success: false });
      console.error("[AI_BRIEFING_ERROR]", err);
      const failure = describeFailure(err);
      return NextResponse.json({ success: false, error: failure.error, code: failure.code }, { status: failure.status });
    }
  } catch (err) {
    console.error("[AI_BRIEFING_CRITICAL_ERROR]", err);
    return NextResponse.json({ success: false, error: "Não foi possível gerar o informativo agora." }, { status: 500 });
  }
}
