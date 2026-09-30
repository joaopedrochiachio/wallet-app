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
  Sparkles,
  Compass,
} from "lucide-react";
import { WalletProvider } from "@/context/WalletContext";
import { AuthProvider } from "@/context/AuthContext";
import { AuthRouteGuard } from "@/components/auth/AuthRouteGuard";
import { WalletLogo } from "@/components/ui/WalletLogo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalonePage =
    pathname === "/" || pathname === "/login" || pathname === "/onboarding";

  return (
    <AuthProvider>
      <AuthRouteGuard>
        <WalletProvider>
          {isStandalonePage ? (
            <div className="min-h-screen w-full flex flex-col bg-[#F2F2F7]">
              {children}
            </div>
          ) : (
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

                <div className="mt-auto space-y-1.5 pt-4 border-t border-gray-200/60">
                  <Link
                    href="/ai"
                    className={`group relative overflow-hidden flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all duration-200 ${
                      pathname === "/ai"
                        ? "bg-black text-white shadow-md ring-1 ring-white/20"
                        : "bg-[#1D1D1F] text-white hover:bg-black shadow-xs hover:shadow-md"
                    } border border-white/10`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                        <Compass size={14} strokeWidth={1.8} className="text-white" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-baseline">
                          <span
                            className="text-xs font-semibold tracking-tight text-white"
                            style={{ fontFamily: 'var(--font-sf-pro), -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
                          >
                            Wallet
                          </span>
                          <span
                            className="text-[13px] font-bold ml-0.5 tracking-tighter text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.85)] leading-none"
                            style={{ fontFamily: 'var(--font-sf-pro), -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
                          >
                            +
                          </span>
                        </div>
                        <span className="text-[10px] text-[#86868B] group-hover:text-[#A1A1A6] transition-colors leading-tight">
                          Inteligência Financeira
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white tracking-wider uppercase font-mono">
                      IA
                    </span>
                  </Link>
                </div>
              </aside>

              {/* ÁREA PRINCIPAL */}
              <main className="flex-1 h-full overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 relative bg-[#F2F2F7] touch-scroll">
                {children}
              </main>

              {/* BOTTOM BAR (Mobile) */}
              <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-200/60 pb-safe z-40">
                <div className="flex justify-around items-center h-14 sm:h-16 px-1">
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
                  {/* IA NO CENTRO COM COR DIFERENCIADA E EMOTE PLUS */}
                  <MobileAiNavItem
                    href="/ai"
                    active={pathname === "/ai"}
                    label="Wallet+"
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
          )}
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
      className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-2xl transition-colors ${
        active ? "text-[#1D1D1F] bg-black/[0.04]" : "text-[#86868B] hover:text-[#1D1D1F]"
      }`}
    >
      {icon}
    </Link>
  );
}

function MobileAiNavItem({
  href,
  active = false,
  label = "Wallet+",
}: {
  href: string;
  active?: boolean;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex items-center justify-center shrink-0 -my-0.5 px-0.5"
    >
      <div
        className={`relative flex items-center px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer select-none ${
          active
            ? "bg-black text-white shadow-md shadow-black/30 scale-105 ring-1 ring-white/25"
            : "bg-[#1D1D1F] text-white shadow-xs hover:scale-105 hover:bg-black"
        } border border-white/10`}
      >
        <span
          className="text-[12px] font-semibold tracking-tight text-white leading-none"
          style={{
            fontFamily:
              'var(--font-sf-pro), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
          }}
        >
          Wallet
        </span>
        <span
          className="text-[13px] font-bold text-white tracking-tighter leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.9)] ml-0.5"
          style={{
            fontFamily:
              'var(--font-sf-pro), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
          }}
          title="Wallet+"
        >
          +
        </span>
      </div>
    </Link>
  );
}
