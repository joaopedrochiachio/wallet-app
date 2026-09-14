"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";
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

import Image from "next/image";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isStandalonePage = pathname === "/" || pathname === "/login" || pathname === "/onboarding";

  if (isStandalonePage) {
    return (
      <html lang="pt-BR" className="scroll-smooth">
        <head>
          <title>Wallet Intelligence</title>
          <meta name="description" content="Wallet Intelligence — Gestão Financeira Pessoal com Padrão Apple Wallet" />
          <link rel="icon" href="/logo2.png" type="image/png" />
          <link rel="apple-touch-icon" href="/logo2.png" />
        </head>
        <body className="min-h-screen bg-[#F2F2F7]">
          <AuthProvider>
            <AuthRouteGuard>
              <WalletProvider>{children}</WalletProvider>
            </AuthRouteGuard>
          </AuthProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <head>
        <title>Wallet Intelligence</title>
        <meta name="description" content="Wallet Intelligence — Gestão Financeira Pessoal com Padrão Apple Wallet" />
        <link rel="icon" href="/logo2.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo2.png" />
      </head>
      <body className="flex h-screen overflow-hidden bg-[#F2F2F7]">
        <AuthProvider>
          <AuthRouteGuard>
            <WalletProvider>
            {/* SIDEBAR (Desktop) */}
            <aside className="hidden md:flex flex-col w-64 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/60 p-6 z-50">
              <Link
                href="/dashboard"
                className="text-xl font-semibold tracking-tight text-[#1D1D1F] mb-8 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                title="Ir para o Dashboard"
              >
              <Image
                src="/logo2.png"
                alt="Wallet Intelligence Logo"
                width={36}
                height={36}
                className="rounded-xl object-contain shadow-xs shrink-0"
                priority
              />
              <div className="flex flex-col">
                <span className="leading-none">Wallet</span>
                <span className="text-[10px] text-[#86868B] font-mono tracking-wider uppercase mt-0.5">
                  Intelligence
                </span>
              </div>
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
          <main className="flex-1 h-full overflow-y-auto pb-24 md:pb-0 relative bg-[#F2F2F7]">
            {children}
          </main>

          {/* BOTTOM BAR (Mobile) */}
          <nav className="md:hidden fixed bottom-0 w-full bg-white/90 backdrop-blur-xl border-t border-gray-200/60 pb-safe z-50">
            <div className="flex justify-around items-center h-16 px-3">
              <MobileNavItem
                href="/dashboard"
                icon={<Home strokeWidth={1.5} size={20} />}
                active={pathname === "/dashboard"}
              />
              <MobileNavItem
                href="/transactions"
                icon={<ArrowLeftRight strokeWidth={1.5} size={20} />}
                active={pathname === "/transactions"}
              />
              <MobileNavItem
                href="/planning"
                icon={<CalendarDays strokeWidth={1.5} size={20} />}
                active={pathname === "/planning"}
              />
              <MobileNavItem
                href="/cards"
                icon={<CreditCard strokeWidth={1.5} size={20} />}
                active={pathname === "/cards"}
              />
              <MobileNavItem
                href="/goals"
                icon={<Target strokeWidth={1.5} size={20} />}
                active={pathname === "/goals"}
              />
              <MobileNavItem
                href="/profile"
                icon={<User strokeWidth={1.5} size={20} />}
                active={pathname === "/profile"}
              />
            </div>
          </nav>
            </WalletProvider>
          </AuthRouteGuard>
      </AuthProvider>
    </body>
  </html>
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
}: {
  href: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`p-2.5 rounded-xl transition-colors ${
        active ? "text-[#1D1D1F]" : "text-[#86868B]"
      }`}
    >
      {icon}
    </Link>
  );
}
