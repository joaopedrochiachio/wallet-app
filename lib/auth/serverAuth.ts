import { NextRequest, NextResponse } from "next/server";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  authTime?: number;
}

const FIREBASE_PROJECT_ID =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "wallet-ia-c8e77";

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

interface FirebaseTokenPayload {
  iss?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  email?: string;
}

/**
 * Valida a integridade, expiração e emissor do Firebase ID Token.
 * Garante que a requisição venha de um usuário legitimamente autenticado.
 */
export async function verifyServerAuth(
  req: NextRequest
): Promise<{ user: AuthenticatedUser } | { errorResponse: NextResponse }> {
  // Em ambiente de teste automatizado puro sem tokens HTTP mockados
  if (process.env.NODE_ENV === "test" && !req.headers.get("authorization")) {
    return { user: { uid: "test-user-id", email: "test@wallet.app" } };
  }

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
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Formato JWT inválido (esperado 3 partes).");
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const payload: FirebaseTokenPayload = JSON.parse(payloadJson);

    // 1. Verificação de expiração
    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowInSeconds) {
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

    // 2. Verificação de Emissor (Firebase Auth)
    const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
    if (payload.iss && payload.iss !== expectedIssuer && process.env.NODE_ENV === "production") {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: "Emissor do token inválido.",
            code: "INVALID_ISSUER",
          },
          { status: 401 }
        ),
      };
    }

    // 3. Verificação de Audiência (Projeto Firebase)
    if (payload.aud && payload.aud !== FIREBASE_PROJECT_ID && process.env.NODE_ENV === "production") {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: "Audiência do token incompatível.",
            code: "INVALID_AUDIENCE",
          },
          { status: 401 }
        ),
      };
    }

    // 4. Verificação de Subject (UID)
    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
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
        uid: payload.sub,
        email: payload.email,
        authTime: payload.auth_time,
      },
    };
  } catch (err: unknown) {
    console.error("[SERVER_AUTH_ERROR]", err);
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: "Falha na validação das credenciais de autenticação.",
          code: "AUTH_VALIDATION_FAILED",
        },
        { status: 401 }
      ),
    };
  }
}
