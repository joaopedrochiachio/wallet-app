"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getUserProfile } from "@/lib/services/userService";

const GUEST_ROUTES = new Set(["/", "/login"]);

export function AuthRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  const isGuestRoute = GUEST_ROUTES.has(pathname);
  const needsGuestRedirect = !loading && Boolean(user) && isGuestRoute;
  const needsProtectedRedirect = !loading && !user && !isGuestRoute;
  const isRedirecting = needsGuestRedirect || needsProtectedRedirect;

  useEffect(() => {
    if (loading) return;

    if (!user && !isGuestRoute) {
      router.replace("/");
      return;
    }

    if (user && isGuestRoute) {
      let cancelled = false;

      getUserProfile(user.uid)
        .then((profile) => {
          if (cancelled) return;
          router.replace(profile?.isOnboarded ? "/dashboard" : "/onboarding");
        })
        .catch((error) => {
          console.error("Não foi possível verificar o onboarding:", error);
          if (!cancelled) router.replace("/dashboard");
        });

      return () => {
        cancelled = true;
      };
    }
  }, [isGuestRoute, loading, router, user]);

  if (loading || isRedirecting) {
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
