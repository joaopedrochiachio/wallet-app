"use client";

import React, { useState } from "react";
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
  BookOpen,
  FlaskConical,
  ScanLine,
  Newspaper,
} from "lucide-react";
import { WalletProvider } from "@/context/WalletContext";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { AuthProvider } from "@/context/AuthContext";
import { AuthRouteGuard } from "@/components/auth/AuthRouteGuard";
import { WalletLogo } from "@/components/ui/WalletLogo";
import { NotificationProvider } from "@/components/ui/macos/Notifications";
import { MacSidebar, MacSidebarItem, MacSidebarItems, MacSidebarSection } from "@/components/ui/macos/Sidebar";
import { MacButton } from "@/components/ui/macos/Button";
import { DynamicIsland } from "@/components/companion/DynamicIsland";
import { FloatingCompanionDock } from "@/components/companion/FloatingCompanionDock";
import {
  ContextualPageTutorialBar,
  InteractiveAppTourModal,
  useTutorialCompleted,
} from "@/components/tutorial/AppTutorialGuide";

function SidebarTutorialButton({ onOpen }: { onOpen: () => void }) {
  const { isTutorialCompleted } = useTutorialCompleted();
  if (isTutorialCompleted) return null;
  return (
    <MacButton
      variant="bordered"
      size="large"
      fullWidth
      onClick={onOpen}
      icon={<BookOpen size={14} strokeWidth={1.8} className="text-mac-orange" />}
    >
      Como Usar (Passo a Passo)
    </MacButton>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isTourOpen, setIsTourOpen] = useState(false);
  const isStandalonePage =
    pathname === "/" || pathname === "/login" || pathname === "/onboarding";

  return (
    <NotificationProvider>
    <AuthProvider>
      <AuthRouteGuard>
        <WalletProvider>
          {isStandalonePage ? (
            <div className="min-h-screen w-full flex flex-col bg-[var(--app-bg)]">
              {children}
            </div>
          ) : (
            <div className="flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[var(--app-bg)]">
              {/* SIDEBAR (Desktop) */}
              <MacSidebar aria-label="Navegação principal" className="hidden md:flex w-60 h-full shrink-0 border-r border-black/[0.06] z-50 pt-5 pb-4">
                <Link
                  href="/dashboard"
                  className="mb-3 flex items-center px-5 hover:opacity-85 transition-opacity"
                  title="Ir para o Dashboard"
                >
                  <WalletLogo variant="lockup" size="md" priority />
                </Link>

                <nav className="min-h-0 flex-1 overflow-y-auto">
                  <MacSidebarItems>
                    <MacSidebarSection>Finanças</MacSidebarSection>
                    <NavItem href="/dashboard" icon={<Home strokeWidth={1.75} size={16} />} label="Dashboard" active={pathname === "/dashboard"} />
                    <NavItem href="/transactions" icon={<ArrowLeftRight strokeWidth={1.75} size={16} />} label="Transações" active={pathname === "/transactions"} />
                    <NavItem href="/planning" icon={<CalendarDays strokeWidth={1.75} size={16} />} label="Planejamento" active={pathname === "/planning"} />
                    <NavItem href="/simulate" icon={<FlaskConical strokeWidth={1.75} size={16} />} label="Simular" active={pathname === "/simulate"} />
                    <NavItem href="/cards" icon={<CreditCard strokeWidth={1.75} size={16} />} label="Cartões & Faturas" active={pathname === "/cards"} />
                    <NavItem href="/goals" icon={<Target strokeWidth={1.75} size={16} />} label="Metas" active={pathname === "/goals"} />

                    <MacSidebarSection>Inteligência</MacSidebarSection>
                    <NavItem href="/ai" icon={<Sparkles strokeWidth={1.75} size={16} />} label="Wallet+ IA" active={pathname === "/ai"} />
                    <NavItem href="/radar" icon={<ScanLine strokeWidth={1.75} size={16} />} label="Raio-X" active={pathname === "/radar"} />
                    <NavItem href="/news" icon={<Newspaper strokeWidth={1.75} size={16} />} label="Notícias" active={pathname === "/news"} />

                    <MacSidebarSection>Conta</MacSidebarSection>
                    <NavItem href="/profile" icon={<User strokeWidth={1.75} size={16} />} label="Perfil & Arquétipo" active={pathname === "/profile"} />
                  </MacSidebarItems>
                </nav>

                <div className="mt-auto px-4 pt-3">
                  <SidebarTutorialButton onOpen={() => setIsTourOpen(true)} />
                </div>
              </MacSidebar>

              {/* ÁREA PRINCIPAL */}
              <main className="flex-1 h-full overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0 relative bg-[var(--app-bg)] touch-scroll">
                {/* ILHA INTERATIVA WALLET (Top Dynamic Island) */}
                <DynamicIsland />

                {/* BARRA DE TUTORIAL DIRETO POR TELA */}
                <ContextualPageTutorialBar />

                {children}

                {/* ATALHO TOUCH FLUTUANTE WALLET */}
                <FloatingCompanionDock />

                {/* MODAL GLOBAL DO TUTORIAL PASSO A PASSO */}
                <InteractiveAppTourModal
                  isOpen={isTourOpen}
                  onClose={() => setIsTourOpen(false)}
                />
              </main>

              {/* BOTTOM BAR (Mobile) */}
              {/* Início, grupos com submenus e a IA no centro */}
              <MobileTabBar
                pathname={pathname}
                aiSlot={<MobileAiNavItem href="/ai" active={pathname === "/ai"} label="Wallet+" />}
              />
            </div>
          )}
        </WalletProvider>
      </AuthRouteGuard>
    </AuthProvider>
    </NotificationProvider>
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
  return <MacSidebarItem href={href} icon={icon} label={label} selected={active} />;
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
      className="touch-target relative flex items-center justify-center shrink-0 -my-0.5 px-0.5"
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
