import { NextRequest, NextResponse } from "next/server";
import { processDueOccurrencesForUser } from "@/lib/services/timeProgressionService";
import { verifyServerAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/utils/rateLimiter";
import { safeCompareTokens } from "@/lib/utils/security";

export const dynamic = "force-dynamic";

/**
 * Valida a autorização da requisição contra IDOR e acessos indevidos:
 * 1. Se CRON_SECRET estiver configurado e o Bearer token coincidir (tempo constante), autoriza execução de cron.
 * 2. Se for um usuário autenticado via Firebase ID Token, autoriza APENAS se request.auth.uid == targetUserId.
 * 3. Bloqueia qualquer tentativa indevida com 401 Unauthorized ou 403 Forbidden.
 */
async function authorizeTimeProgression(
  request: NextRequest,
  targetUserId: string
): Promise<{ authorized: true } | { authorized: false; status: number; error: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // 1. Autorização via segredo de cron de backend com comparação em tempo constante
  if (cronSecret && authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && safeCompareTokens(token, cronSecret)) {
      return { authorized: true };
    }
  }

  // 2. Autorização de usuário via Firebase ID Token
  const authResult = await verifyServerAuth(request);
  if ("user" in authResult) {
    // Blindagem Anti-IDOR: Usuário só pode disparar a progressão de suas próprias finanças
    if (authResult.user.uid !== targetUserId) {
      return {
        authorized: false,
        status: 403,
        error: "Acesso negado. Você só tem autorização para processar ocorrências da sua própria conta.",
      };
    }
    return { authorized: true };
  }

  return {
    authorized: false,
    status: 401,
    error: "Acesso não autorizado. Token de autenticação ou segredo de cron obrigatório.",
  };
}

function parseAndValidateAsOfDate(asOfParam: string | null): Date | null {
  if (!asOfParam) return new Date();

  const parsed = new Date(asOfParam);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Teto de segurança: não permitir datas futuras além de 24 horas a partir de agora
  const maxAllowed = new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (parsed.getTime() > maxAllowed.getTime()) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  const asOfParam = searchParams.get("asOfDate");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId obrigatório para processamento." },
      { status: 400 }
    );
  }

  // Validação estrita de autorização e proteção IDOR
  const authCheck = await authorizeTimeProgression(request, userId);
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: authCheck.error },
      { status: authCheck.status }
    );
  }

  // Rate Limiting anti-abuso (máx 10 chamadas por minuto por usuário)
  const rateLimit = checkRateLimit(`time-progression:${userId}`, 10, 60000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Muitas solicitações de progressão. Aguarde ${rateLimit.retryAfterSec} segundos.`,
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

  const asOfDate = parseAndValidateAsOfDate(asOfParam);
  if (!asOfDate) {
    return NextResponse.json(
      { success: false, error: "asOfDate inválida ou além do limite permitido." },
      { status: 400 }
    );
  }

  try {
    const result = await processDueOccurrencesForUser(userId, asOfDate);
    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      processedOccurrences: result.processedOccurrences,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TIME_PROGRESSION_GET_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao processar ocorrências financeiras.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const asOfParam = body.asOfDate;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId obrigatório no corpo da requisição." },
        { status: 400 }
      );
    }

    // Validação estrita de autorização e proteção IDOR
    const authCheck = await authorizeTimeProgression(request, userId);
    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.status }
      );
    }

    // Rate Limiting anti-abuso (máx 10 chamadas por minuto por usuário)
    const rateLimit = checkRateLimit(`time-progression:${userId}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Muitas solicitações de progressão. Aguarde ${rateLimit.retryAfterSec} segundos.`,
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

    const asOfDate = parseAndValidateAsOfDate(asOfParam);
    if (!asOfDate) {
      return NextResponse.json(
        { success: false, error: "asOfDate inválida ou além do limite permitido." },
        { status: 400 }
      );
    }

    const result = await processDueOccurrencesForUser(userId, asOfDate);

    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      processedOccurrences: result.processedOccurrences,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[TIME_PROGRESSION_POST_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno ao processar ocorrências financeiras.",
      },
      { status: 500 }
    );
  }
}
