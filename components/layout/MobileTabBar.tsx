"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight, CalendarDays, CreditCard, FlaskConical, Home, LayoutGrid, Newspaper,
  ScanLine, Target, User, Wallet,
} from "lucide-react";

interface SubItem {
  href: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

interface Group {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SubItem[];
}

const ICON = { strokeWidth: 1.6, size: 20 } as const;

/** Barra do celular: 5 posições, grupos abrem um painel com os submenus. */
const GROUPS: Group[] = [
  {
    id: "money",
    label: "Dinheiro",
    icon: <Wallet {...ICON} />,
    items: [
      { href: "/transactions", label: "Transações", hint: "Tudo o que entrou e saiu", icon: <ArrowLeftRight {...ICON} /> },
      { href: "/cards", label: "Cartões & Faturas", hint: "Faturas, limite e parcelas", icon: <CreditCard {...ICON} /> },
    ],
  },
  {
    id: "plan",
    label: "Planejar",
    icon: <CalendarDays {...ICON} />,
    items: [
      { href: "/planning", label: "Planejamento", hint: "Contas do mês e se dá pra pagar", icon: <CalendarDays {...ICON} /> },
      { href: "/simulate", label: "Simular", hint: "E se eu gastar ou guardar?", icon: <FlaskConical {...ICON} /> },
      { href: "/goals", label: "Metas", hint: "Dinheiro guardado para objetivos", icon: <Target {...ICON} /> },
    ],
  },
  {
    id: "more",
    label: "Mais",
    icon: <LayoutGrid {...ICON} />,
    items: [
      { href: "/radar", label: "Raio-X", hint: "Quanto pesam as recorrentes", icon: <ScanLine {...ICON} /> },
      { href: "/news", label: "Notícias", hint: "Economia e o que muda no seu bolso", icon: <Newspaper {...ICON} /> },
      { href: "/profile", label: "Perfil", hint: "Conta, tema e dados", icon: <User {...ICON} /> },
    ],
  },
];

export function MobileTabBar({ pathname, aiSlot }: { pathname: string; aiSlot: React.ReactNode }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Fecha ao trocar de tela e com Esc.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroup(null);
  }, [pathname]);
  useEffect(() => {
    if (!openGroup) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenGroup(null);
    window.addEventListener("keydown", onKey);
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [openGroup]);

  const group = GROUPS.find((item) => item.id === openGroup) ?? null;
  const isActive = (target: Group) => target.items.some((item) => item.href === pathname);
  const [money, plan, more] = GROUPS;

  return (
    <>
      {group && (
        <div className="md:hidden fixed inset-0 z-[39]" onClick={() => setOpenGroup(null)} aria-hidden>
          <div className="absolute inset-0 bg-black/25 animate-apple-backdrop" />
        </div>
      )}
      {group && (
        <div
          ref={sheetRef}
          id={`tab-sheet-${group.id}`}
          role="menu"
          aria-label={group.label}
          className="md:hidden fixed left-2 right-2 z-[41] rounded-[20px] border border-black/[0.06] bg-[var(--fb-card)] p-2 shadow-2xl animate-apple-modal"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fb-text-3)]">{group.label}</p>
          {group.items.map((item) => {
            const active = item.href === pathname;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpenGroup(null)}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors ${active ? "bg-[var(--fb-accent-bg)]" : "hover:bg-[var(--fb-card-2)]"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${active ? "bg-[var(--fb-accent)] text-white" : "bg-[var(--fb-card-2)] text-[var(--fb-text)]"}`}>
                  {item.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--fb-text)]">{item.label}</span>
                  <span className="block truncate text-xs text-[var(--fb-text-3)]">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <nav aria-label="Navegação" className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-[var(--mac-glass-control-bg)] backdrop-blur-xl backdrop-saturate-[1.8] border-t border-black/[0.06] pb-safe z-40">
        <div className="flex h-16 items-center justify-around px-1">
          <TabLink href="/dashboard" label="Início" icon={<Home {...ICON} />} active={pathname === "/dashboard"} />
          <TabGroupButton group={money} active={isActive(money)} open={openGroup === money.id} onToggle={setOpenGroup} />
          {aiSlot}
          <TabGroupButton group={plan} active={isActive(plan)} open={openGroup === plan.id} onToggle={setOpenGroup} />
          <TabGroupButton group={more} active={isActive(more)} open={openGroup === more.id} onToggle={setOpenGroup} />
        </div>
      </nav>
    </>
  );
}

const tabClass = (active: boolean) =>
  `flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition-colors ${
    active ? "text-[#1D1D1F]" : "text-[#86868B] hover:text-[#1D1D1F]"
  }`;

function TabLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
      {icon}
      <span className={`text-[10px] leading-none ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
    </Link>
  );
}

function TabGroupButton({ group, active, open, onToggle }: { group: Group; active: boolean; open: boolean; onToggle: (id: string | null) => void }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(open ? null : group.id)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? `tab-sheet-${group.id}` : undefined}
      className={`${tabClass(active || open)} cursor-pointer`}
    >
      {group.icon}
      <span className={`flex items-center gap-0.5 text-[10px] leading-none ${active || open ? "font-semibold" : "font-medium"}`}>
        {group.label}
        {active && !open && <span className="h-1 w-1 rounded-full bg-[var(--fb-accent)]" aria-hidden />}
      </span>
    </button>
  );
}
