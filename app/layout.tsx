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
  Sparkles,
} from "lucide-react";
import { WalletProvider } from "@/context/WalletContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <html lang="pt-BR" className="scroll-smooth">
        <body className="min-h-screen bg-[#F2F2F7]">
          <WalletProvider>{children}</WalletProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR">
      <body className="flex h-screen overflow-hidden bg-[#F2F2F7]">
        <WalletProvider>
          {/* SIDEBAR (Desktop) */}
          <aside className="hidden md:flex flex-col w-64 h-full bg-white/80 backdrop-blur-xl border-r border-gray-200/60 p-6 z-50">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight text-[#1D1D1F] mb-8 flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Ir para a Apresentação Wallet Intelligence"
            >
              <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                W
              </div>
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
                href="/"
                icon={<Sparkles strokeWidth={1.5} size={18} className="text-purple-600" />}
                label="Showcase 3D"
                active={false}
              />
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