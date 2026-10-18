import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Padrões de varreduras maliciosas, sondagens de servidores, path traversal e injeções
const SUSPICIOUS_PATH_PATTERNS = [
  /\.\./, // Path traversal (..)
  /%2e%2e/i, // Path traversal codificado
  /%252e%252e/i, // Path traversal com dupla codificação
  /%00|\x00/i, // Injeção de Null-byte
  /\/\.env/i, // Arquivos de ambiente
  /\/\.git/i, // Repositórios git expostos
  /\/\.aws/i, // Credenciais de nuvem
  /\/\.ssh/i, // Chaves SSH
  /\/\.htaccess/i,
  /\/\.ds_store/i,
  /\/wp-admin/i, // Scanners WordPress
  /\/wp-login/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/actuator/i, // Endpoints Spring/Java
  /\/cgi-bin/i,
  /\/solr/i,
  /\.(bak|config|sql|tar|gz|zip|sh|bat)$/i, // Dumps e scripts
];

const MAX_URL_LENGTH = 2048;

function createSecurityResponse(body: string, status: number): NextResponse {
  const response = new NextResponse(body, { status });
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const rawUrl = request.url;

  // 1. Defesa contra estouro de buffer e DoS via URLs gigantescas
  if (rawUrl.length > MAX_URL_LENGTH) {
    return createSecurityResponse("URL Too Long", 414);
  }

  // 2. Defesa contra sondagem de caminhos sensíveis e path traversal
  const hasSuspiciousPath = SUSPICIOUS_PATH_PATTERNS.some((pattern) =>
    pattern.test(pathname) || pattern.test(rawUrl)
  );

  if (hasSuspiciousPath) {
    return createSecurityResponse("Access Denied", 400);
  }

  // 3. Proteção Anti-CSRF em rotas de mutação de API (/api/* com POST, PUT, DELETE, PATCH)
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const hasAuth = Boolean(request.headers.get("authorization"));

    // Se não for autenticado via Bearer Token e houver Origin de outro domínio, bloqueia requisição cross-origin não autorizada
    if (!hasAuth && origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return createSecurityResponse("Cross-Origin Request Blocked", 403);
        }
      } catch {
        return createSecurityResponse("Invalid Origin Header", 400);
      }
    }
  }

  // Prossegue com a requisição normalmente
  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica o middleware a todas as rotas exceto arquivos estáticos internos:
     * - _next/static (arquivos estáticos compilados)
     * - _next/image (otimização de imagens)
     * - favicon.ico, ícones, imagens estáticas
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
