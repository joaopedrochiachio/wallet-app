"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  CalendarDays,
  CreditCard,
  Target,
  MessageCircle,
  User,
} from "lucide-react";
import { WalletProvider } from "@/context/WalletContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthRouteGuard } from "@/components/auth/AuthRouteGuard";
import { WalletLogo } from "@/components/ui/WalletLogo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalonePage =
    pathname === "/" || pathname === "/login" || pathname === "/onboarding";

  if (isStandalonePage) {
    return (
      <AuthProvider>
        <AuthRouteGuard>
          <WalletProvider>
            <div className="min-h-screen w-full flex flex-col bg-[#F2F2F7]">
              {children}
            </div>
          </WalletProvider>
        </AuthRouteGuard>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <AuthRouteGuard>
        <WalletProvider>
          <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[#F2F2F7]">
            {/* SIDEBAR (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/60 p-6 z-50 shrink-0">
            <Link
              href="/dashboard"
              className="mb-8 flex items-center hover:opacity-85 transition-opacity"
              title="Ir para o Dashboard"
            >
              <WalletLogo variant="lockup" size="md" priority />
            </Link>

            <nav className="flex flex-col gap-2 flex-1">
              <NavItem
                href="/dashboard"
                icon={<Home strokeWidth={1.5} size={18} />}
                label="Dashboard"
                active={pathname === "/dashboard"}
              />
              <NavItem
                href="/transactions"
                icon={<ArrowLeftRight strokeWidth={1.5} size={18} />}
                label="Transações"
                active={pathname === "/transactions"}
              />
              <NavItem
                href="/planning"
                icon={<CalendarDays strokeWidth={1.5} size={18} />}
                label="Planejamento"
                active={pathname === "/planning"}
              />
              <NavItem
                href="/cards"
                icon={<CreditCard strokeWidth={1.5} size={18} />}
                label="Cartões & Faturas"
                active={pathname === "/cards"}
              />
              <NavItem
                href="/goals"
                icon={<Target strokeWidth={1.5} size={18} />}
                label="Metas"
                active={pathname === "/goals"}
              />
              <NavItem
                href="/profile"
                icon={<User strokeWidth={1.5} size={18} />}
                label="Perfil & Arquétipo"
                active={pathname === "/profile"}
              />
            </nav>

            <div className="mt-auto space-y-1.5">
              <NavItem
                href="#"
                icon={<MessageCircle strokeWidth={1.5} size={18} />}
                label="AI Assistant"
                active={pathname === "/ai"}
              />
            </div>
          </aside>

          {/* ÁREA PRINCIPAL */}
          <main className="flex-1 h-full overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 relative bg-[#F2F2F7] touch-scroll">
            {children}
          </main>

          {/* BOTTOM BAR (Mobile) */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-200/60 pb-safe z-50">
            <div className="flex justify-around items-center h-14 sm:h-16 px-2">
              <MobileNavItem
                href="/dashboard"
                icon={<Home strokeWidth={1.5} size={21} />}
                active={pathname === "/dashboard"}
                label="Dashboard"
              />
              <MobileNavItem
                href="/transactions"
                icon={<ArrowLeftRight strokeWidth={1.5} size={21} />}
                active={pathname === "/transactions"}
                label="Transações"
              />
              <MobileNavItem
                href="/planning"
                icon={<CalendarDays strokeWidth={1.5} size={21} />}
                active={pathname === "/planning"}
                label="Planejamento"
              />
              <MobileNavItem
                href="/cards"
                icon={<CreditCard strokeWidth={1.5} size={21} />}
                active={pathname === "/cards"}
                label="Cartões"
              />
              <MobileNavItem
                href="/goals"
                icon={<Target strokeWidth={1.5} size={21} />}
                active={pathname === "/goals"}
                label="Metas"
              />
              <MobileNavItem
                href="/profile"
                icon={<User strokeWidth={1.5} size={21} />}
                active={pathname === "/profile"}
                label="Perfil"
              />
            </div>
          </nav>
          </div>
        </WalletProvider>
      </AuthRouteGuard>
    </AuthProvider>
  );
}

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
        active
          ? "bg-[#1D1D1F] text-white shadow-xs"
          : "text-[#86868B] hover:bg-[#F2F2F7] hover:text-[#1D1D1F]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function MobileNavItem({
  href,
  icon,
  active = false,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl transition-colors ${
        active ? "text-[#1D1D1F] bg-black/[0.04]" : "text-[#86868B] hover:text-[#1D1D1F]"
      }`}
    >
      {icon}
    </Link>
  );
}
