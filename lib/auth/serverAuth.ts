import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server.js";
import { getAdminAuth, isAdminAuthMockActive } from "../firebaseAdmin.ts";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  authTime?: number;
}

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }
  try {
    const res = await fetch(
      "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
    );
    if (!res.ok) return null;
    const certs = (await res.json()) as Record<string, string>;
    cachedGoogleCerts = {
      certs,
      expiresAt: now + 60 * 60 * 1000,
    };
    return certs;
  } catch {
    return null;
  }
}

/**
 * Fallback de verificação criptográfica em produção via API REST oficial do Firebase Identity Toolkit
 * e verificação de assinatura RSA-SHA256 com certificados públicos x509 da Google.
 */
function cleanEnvString(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']+|["']+$/g, "").trim();
}

async function verifyFirebaseTokenProdFallback(token: string): Promise<AuthenticatedUser | null> {
  const projectId =
    cleanEnvString(process.env.FIREBASE_PROJECT_ID) ||
    cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
    "wallet-ia-c8e77";
  const apiKey = cleanEnvString(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

  // 1. Decodifica e valida estritamente os claims obrigatórios do JWT antes de qualquer chamada externa
  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    user_id?: string;
    email?: string;
    exp?: number;
    auth_time?: number;
  };
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const headerJson = Buffer.from(parts[0], "base64url").toString("utf-8");
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
    header = JSON.parse(headerJson);
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const uid = (payload.sub || payload.user_id || "").trim();

  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    header.kid.length === 0 ||
    payload.iss !== expectedIssuer ||
    payload.aud !== projectId ||
    !uid ||
    typeof payload.exp !== "number" ||
    payload.exp <= nowSec
  ) {
    return null;
  }

  // 2. Valida diretamente na API oficial do Firebase Auth (Google Identity Toolkit)
  if (apiKey && !apiKey.includes("your-api-key")) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          users?: Array<{ localId?: string; email?: string; disabled?: boolean }>;
        };
        const userRecord = data?.users?.[0];
        if (userRecord && userRecord.localId === uid && !userRecord.disabled) {
          return {
            uid: userRecord.localId,
            email: userRecord.email || payload.email,
            authTime: payload.auth_time,
          };
        }
        return null;
      }
      // Se o Identity Toolkit respondeu 400 (token inválido, forjado ou revogado), bloqueia imediatamente
      if (res.status === 400) {
        return null;
      }
    } catch {
      // Prossegue para verificação criptográfica RSA-SHA256 com certificados públicos x509 da Google
    }
  }

  // 3. Verificação criptográfica RSA-SHA256 contra os certificados públicos x509 oficiais da Google
  try {
    const certs = await getGooglePublicCerts();
    const certPem = certs?.[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const signatureBuf = Buffer.from(parts[2], "base64url");
    const isSignatureValid = verifier.verify(certPem, signatureBuf);
    if (!isSignatureValid) return null;

    return {
      uid,
      email: payload.email,
      authTime: payload.auth_time,
    };
  } catch {
    return null;
  }
}

/**
 * Valida a autenticidade, assinatura criptográfica e claims do Firebase ID Token.
 * Utiliza o Firebase Admin SDK no servidor com fallback resiliente em produção
 * caso a Service Account não esteja configurada na Vercel.
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
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token, true);
    } catch (innerErr: unknown) {
      // Se estivermos em teste unitário com mock ativo, respeita estritamente o erro do mock
      if (isAdminAuthMockActive()) {
        throw innerErr;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerCode = String((innerErr as any)?.code || "");
      if (innerCode === "auth/id-token-expired" || innerCode === "auth/id-token-revoked") {
        throw innerErr;
      }
      // Tenta verificar apenas a assinatura RS256 via chaves públicas da Google (não exige Service Account)
      decodedToken = await adminAuth.verifyIdToken(token, false);
    }

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

    // Em produção (sem mock de teste), se o Firebase Admin falhar por falta de Service Account na Vercel,
    // tenta validar o token via Identity Toolkit / RS256 claims do projeto
    if (!isAdminAuthMockActive() && errorCode !== "auth/id-token-expired" && errorCode !== "auth/id-token-revoked") {
      const fallbackUser = await verifyFirebaseTokenProdFallback(token);
      if (fallbackUser) {
        return { user: fallbackUser };
      }
    }

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
