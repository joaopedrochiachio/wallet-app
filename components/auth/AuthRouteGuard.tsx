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
    } else if (user && pathname === "/login") {
      router.replace("/dashboard");
    }
  }, [isPublicRoute, loading, pathname, router, user]);

  if ((!isPublicRoute && loading) || needsProtectedRedirect) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-[#F2F2F7]"
        aria-label="Verificando sessão"
      >
        <Loader2 className="animate-spin text-[#86868B]" size={24} />
      </div>
    );
  }

  return children;
}
