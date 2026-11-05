import { NextRequest, NextResponse } from "next/server.js";
import { verifyServerAuth } from "../../../../lib/auth/serverAuth.ts";
import { getAIUsageSummary } from "../../../../lib/services/aiUsageService.ts";
import { safeCompareTokens } from "../../../../lib/utils/security.ts";
import { checkRateLimit } from "../../../../lib/utils/rateLimiter.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Consulta Segura de Consumo e Limites de IA
 * - Administradores (autenticados via Bearer CRON_SECRET): acessam consumo global e de qualquer usuário.
 * - Usuários comuns (autenticados via Firebase Auth): acessam estritamente o seu próprio consumo individual.
 */
export async function GET(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    let isAdmin = false;
    let targetUid: string | undefined = undefined;

    // 1. Verificação de segredo de administração/cron em tempo constante
    if (cronSecret && authHeader) {
      const [scheme, token] = authHeader.split(" ");
      if (scheme?.toLowerCase() === "bearer" && safeCompareTokens(token, cronSecret)) {
        isAdmin = true;
      }
    }

    // 2. Se não for admin via secret, verifica token Firebase do usuário
    if (!isAdmin) {
      const authResult = await verifyServerAuth(req);
      if ("errorResponse" in authResult) {
        return authResult.errorResponse;
      }
      // Usuário comum restrito exclusivamente ao seu próprio UID
      targetUid = authResult.user.uid;
    } else {
      // Admin pode especificar targetUid via query param
      const searchParams = req.nextUrl.searchParams;
      targetUid = searchParams.get("uid") || undefined;
    }

    // 3. Rate limiting contra abuso/DoS (30 consultas por minuto por cliente)
    const rateLimitKey = `ai-usage:${targetUid || "admin"}`;
    const rateLimit = checkRateLimit(rateLimitKey, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas consultas ao relatório de uso de IA. Aguarde ${rateLimit.retryAfterSec} segundos.`,
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

    const searchParams = req.nextUrl.searchParams;
    const monthKey = searchParams.get("month") || undefined;

    const summary = await getAIUsageSummary({
      targetUid,
      monthKey,
      isAdmin,
    });

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err: unknown) {
    console.error("[AI_USAGE_QUERY_ERROR]", err);
    return NextResponse.json(
      { success: false, error: "Falha ao obter relatório de uso de IA." },
      { status: 500 }
    );
  }
}
