import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Padrões de varreduras maliciosas, sondagens de servidores e path traversal
const SUSPICIOUS_PATH_PATTERNS = [
  /\.\./, // Path traversal (..)
  /%2e%2e/i, // Path traversal codificado
  /\/\.env/i, // Arquivos de ambiente
  /\/\.git/i, // Repositórios git expostos
  /\/\.aws/i, // Credenciais de nuvem
  /\/\.ssh/i, // Chaves SSH
  /\/\.htaccess/i,
  /\/\.ds_store/i,
  /\/wp-admin/i, // Scanners WordPress
  /\/wp-login/i,
  /\/phpmyadmin/i,
  /\/actuator/i, // Endpoints Spring/Java
  /\/cgi-bin/i,
  /\.(bak|config|sql|tar|gz|zip|sh|bat)$/i, // Dumps e scripts
];

const MAX_URL_LENGTH = 2048;

export function middleware(request: NextRequest) {
  const url = request.nextUrl.pathname;
  const rawUrl = request.url;

  // 1. Defesa contra estouro de buffer e DoS via URLs gigantescas
  if (rawUrl.length > MAX_URL_LENGTH) {
    return new NextResponse("URL Too Long", { status: 414 });
  }

  // 2. Defesa contra sondagem de caminhos sensíveis e path traversal
  const hasSuspiciousPath = SUSPICIOUS_PATH_PATTERNS.some((pattern) =>
    pattern.test(url)
  );

  if (hasSuspiciousPath) {
    return new NextResponse("Access Denied", { status: 400 });
  }

  // Prossegue com a requisição normalmente
  return NextResponse.next();
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
