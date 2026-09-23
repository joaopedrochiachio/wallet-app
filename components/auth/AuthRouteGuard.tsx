"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const PUBLIC_ROUTES = new Set(["/", "/login"]);

export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const needsProtectedRedirect = !loading && !user && !isPublicRoute;

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicRoute) {
      router.replace("/login");

      // Fallback de segurança para garantir o redirecionamento caso a transição trave
      const timer = setTimeout(() => {
        if (!PUBLIC_ROUTES.has(window.location.pathname)) {
          window.location.replace("/login");
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isPublicRoute, loading, router, user]);

  // Enquanto a autenticação estiver carregando ou enquanto o redirecionamento estiver ocorrendo,
  // exibe tela opaca com spinner. Isso garante que nenhum dado privado ou layout interno seja exposto.
  if ((!isPublicRoute && loading) || needsProtectedRedirect) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-[#F2F2F7]"
        aria-label="Verificando sessão segura"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-[#86868B]" size={26} />
          <span className="text-xs text-[#86868B] font-medium tracking-tight">
            Autenticando sessão segura...
          </span>
        </div>
      </div>
    );
  }

  return children;
}
