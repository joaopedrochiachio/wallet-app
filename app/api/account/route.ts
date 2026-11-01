import { NextRequest, NextResponse } from "next/server.js";
import { verifyServerAuth } from "../../../lib/auth/serverAuth.ts";
import {
  deleteCompleteAccount,
  exportCompleteAccountData,
} from "../../../lib/services/accountAdminService.ts";
import { checkRateLimit } from "../../../lib/utils/rateLimiter.ts";

export const dynamic = "force-dynamic";

const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const authResult = await verifyServerAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const rateLimit = checkRateLimit(`account-export:${authResult.user.uid}`, 3, 60_000);
  if (!rateLimit.allowed) {
    return jsonNoStore(
      { success: false, error: "Muitas exportações solicitadas. Aguarde antes de tentar novamente." },
      429
    );
  }

  try {
    const data = await exportCompleteAccountData(authResult.user.uid);
    return jsonNoStore({ success: true, data });
  } catch (error) {
    console.error("[ACCOUNT_EXPORT_ERROR]", error);
    return jsonNoStore(
      { success: false, error: "Não foi possível exportar todos os dados da conta." },
      500
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await verifyServerAuth(request);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  const authTime = authResult.user.authTime;
  const tokenAgeSeconds = authTime ? Math.floor(Date.now() / 1000) - authTime : Infinity;
  if (tokenAgeSeconds < 0 || tokenAgeSeconds > RECENT_AUTH_MAX_AGE_SECONDS) {
    return jsonNoStore(
      {
        success: false,
        code: "REAUTHENTICATION_REQUIRED",
        error: "A exclusão exige uma autenticação realizada nos últimos cinco minutos.",
      },
      403
    );
  }

  const rateLimit = checkRateLimit(`account-delete:${authResult.user.uid}`, 3, 15 * 60_000);
  if (!rateLimit.allowed) {
    return jsonNoStore(
      { success: false, error: "Muitas tentativas de exclusão. Aguarde antes de tentar novamente." },
      429
    );
  }

  try {
    await deleteCompleteAccount(authResult.user.uid);
    return jsonNoStore({ success: true });
  } catch (error) {
    console.error("[ACCOUNT_DELETE_ERROR]", error);
    return jsonNoStore(
      {
        success: false,
        error: "Não foi possível confirmar a exclusão completa. Entre novamente e tente outra vez.",
      },
      500
    );
  }
}
