import { NextRequest, NextResponse } from "next/server.js";
import { getAdminAuth } from "../firebaseAdmin.ts";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  authTime?: number;
}

/**
 * Valida a autenticidade, assinatura criptográfica e claims do Firebase ID Token.
 * Utiliza exclusivamente o Firebase Admin SDK no servidor (verifyIdToken com verificação estrita).
 * Rejeita categoricamente qualquer token forjado, adulterado, expirado ou sem assinatura válida.
 */
export async function verifyServerAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser } | { errorResponse: NextResponse }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: "Acesso não autorizado. É necessário estar autenticado para realizar esta operação.",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: "Token de autenticação ausente ou em formato inválido.",
          code: "INVALID_TOKEN",
        },
        { status: 401 }
      ),
    };
  }

  try {
    const adminAuth = getAdminAuth();
    // Valida criptograficamente assinatura (RS256), audiência, emissor e expiração via Google Public Keys em cache (instantâneo).
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (!decodedToken.uid || typeof decodedToken.uid !== "string" || decodedToken.uid.trim().length === 0) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: "Identificador do usuário ausente no token.",
            code: "INVALID_SUBJECT",
          },
          { status: 401 }
        ),
      };
    }

    return {
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        authTime: decodedToken.auth_time,
      },
    };
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authErr = err as any;
    const errorCode = authErr?.code || "AUTH_VALIDATION_FAILED";

    console.error("[SERVER_AUTH_ERROR]", errorCode, authErr?.message);

    if (errorCode === "auth/id-token-expired") {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: "Sua sessão expirou. Faça login novamente.",
            code: "TOKEN_EXPIRED",
          },
          { status: 401 }
        ),
      };
    }

    if (errorCode === "auth/id-token-revoked") {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: "Sessão revogada. Faça login novamente.",
            code: "TOKEN_REVOKED",
          },
          { status: 401 }
        ),
      };
    }

    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: "Credenciais de autenticação inválidas ou com assinatura ilegítima.",
          code: "INVALID_TOKEN_SIGNATURE",
        },
        { status: 401 }
      ),
    };
  }
}
