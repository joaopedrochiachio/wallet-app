"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  ExternalLink,
  Flag,
  Globe2,
  Landmark,
  Lightbulb,
  MessageCircle,
  Newspaper,
  RefreshCw,
  ShoppingBag,
  Sun,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { getBestCardToSpendToday, getUpcomingFinancialEvents } from "@/lib/services/dailyCompanionService";
import { useMonthAnalytics } from "@/lib/hooks/useMonthAnalytics";
import type { FinancialAnalytics } from "@/lib/services/financialAnalyticsService";
import type { GuidanceMode, SpendingGuidance } from "@/lib/services/spendingGuidance";
import type { MarketBriefing } from "@/types/market";
import { Cofi, type CofiState } from "@/components/assistant/Cofi";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import { QuickCaptureModal } from "./QuickCaptureModal";

/**
 * Painel do Cofi (ilha no topo). Fechado: uma pílula com a orientação do dia.
 * Aberto: painel no estilo "Side Bar for iOS" (Figma), com navegação lateral
 * (Hoje, Agenda, Radar), atalhos e um resumo didático do mês. Os números vêm da
 * mesma análise que a IA usa (useMonthAnalytics).
 */

type ActiveTab = "hoje" | "agenda" | "radar";

const brl = (value: number, cents = true) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

function formatQuote(value: number, kind: "currency" | "index") {
  if (kind === "currency") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });
  return Math.round(value).toLocaleString("pt-BR");
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const MODE_LABEL: Record<GuidanceMode, { label: string; tone: string; text: string }> = {
  livre: { label: "Dá para gastar", tone: "bg-[var(--sb-good-bg)] text-[var(--sb-good)]", text: "text-[var(--sb-good)]" },
  contido: { label: "Gasto contido", tone: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]", text: "text-[var(--sb-warn)]" },
  essencial: { label: "Só o essencial", tone: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]", text: "text-[var(--sb-warn)]" },
  pausa: { label: "Pausa nos gastos", tone: "bg-[var(--sb-bad-bg)] text-[var(--sb-bad)]", text: "text-[var(--sb-bad)]" },
};

function cofiStateFor(guidance: SpendingGuidance, urgent: boolean): CofiState {
  if (guidance.mode === "pausa") return "alerta";
  if (urgent || guidance.mode === "essencial") return "pensando";
  return "ocioso";
}

/** Ação mais importante agora, em linguagem direta. */
function recommendedAction(params: {
  analytics: FinancialAnalytics;
  guidance: SpendingGuidance;
  urgent: { title: string; amount: number; daysRemaining: number; id: string } | undefined;
  bestCard: { cardName: string; availableLimit: number } | null;
}): { tone: "warn" | "bad" | "good"; title: string; text: string } {
  const { analytics: a, urgent, bestCard } = params;
  if (urgent) {
    return { tone: "warn", title: `${urgent.title} vence ${urgent.daysRemaining === 0 ? "hoje" : "amanhã"}`, text: `Garanta ${brl(urgent.amount)} na conta para não atrasar.` };
  }
  if (a.cash.projectedClose < 0) {
    return { tone: "bad", title: "O mês fecha no negativo", text: `Mesmo com o que vai entrar, faltam ${brl(-a.cash.projectedClose)}. Corte gastos que podem esperar e reveja as contas do mês.` };
  }
  if (a.timeline.negativeFromDay !== null && a.timeline.recoveryIncome) {
    const bill = a.timeline.events.find((e) => e.direction === "out" && e.day === a.timeline.negativeFromDay);
    return {
      tone: "warn",
      title: `Dinheiro curto no dia ${a.timeline.negativeFromDay}`,
      text: `${bill ? `${bill.title} (${brl(bill.amount)}) vence` : "Uma conta vence"} antes de ${a.timeline.recoveryIncome.title} cair no dia ${a.timeline.recoveryIncome.day}. Negocie a data ou separe ${brl(-a.timeline.lowestBalance)} até lá.`,
    };
  }
  if (a.target.gap < 0) {
    return { tone: "warn", title: "Meta do mês em risco", text: `Faltam ${brl(-a.target.gap)} para a meta. Segure compras novas até o fim do mês.` };
  }
  if (a.spending.biggestIncrease) {
    const c = a.spending.biggestIncrease;
    return { tone: "warn", title: `${c.category} acima do normal`, text: `${brl(c.monthToDate)} até hoje, contra ${brl(c.samePeriodAverage ?? 0)} na sua média. Vale frear até o fim do mês.` };
  }
  if (bestCard) {
    return { tone: "good", title: "Tudo em ordem", text: `Se precisar comprar no crédito, ${bestCard.cardName} dá o maior prazo agora (${brl(bestCard.availableLimit)} de limite livre).` };
  }
  return { tone: "good", title: "Tudo em ordem", text: "Nenhuma urgência. Siga a orientação de gasto do dia." };
}

export function DynamicIsland() {
  const { userProfile, cards, recurringItems, transactions, getMonthlyProjection, realizeRecurringItemNow } = useWallet();
  const { analytics, guidance } = useMonthAnalytics();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hoje");
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketBriefing | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  const islandRef = useRef<HTMLDivElement>(null);

  const currentMonthProjection = getMonthlyProjection(0);
  const upcomingEvents = useMemo(
    () =>
      getUpcomingFinancialEvents({
        cards,
        recurringItems,
        transactions,
        cardInvoiceProjections: currentMonthProjection?.cardInvoices,
        onlyExpenses: false,
      }),
    [cards, recurringItems, transactions, currentMonthProjection?.cardInvoices]
  );
  const urgentEvents = upcomingEvents.filter((event) => event.isUrgent && event.type !== "planned_income");
  const bestCard = useMemo(() => getBestCardToSpendToday({ cards }), [cards]);
  const firstName = (userProfile.name || "você").split(" ")[0];
  const action = recommendedAction({ analytics, guidance, urgent: urgentEvents[0], bestCard });

  const loadMarket = useCallback(async () => {
    setMarketLoading(true);
    setMarketError(false);
    try {
      const response = await fetch("/api/market/briefing", { cache: "no-store" });
      if (!response.ok) throw new Error("Radar indisponível");
      setMarket((await response.json()) as MarketBriefing);
    } catch {
      setMarketError(true);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMarket(), 0);
    const interval = window.setInterval(() => void loadMarket(), 5 * 60 * 1000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [loadMarket]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) setIsExpanded(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const payEvent = async (eventId: string) => {
    const item = recurringItems.find((candidate) => candidate.id === eventId.replace("recurring_", ""));
    if (!item) return;
    setPayingId(eventId);
    try {
      const now = new Date();
      await realizeRecurringItemNow(item, now.getFullYear(), now.getMonth());
    } finally {
      setPayingId(null);
    }
  };

  const close = () => setIsExpanded(false);
  const openQuickCapture = () => {
    close();
    setIsQuickCaptureOpen(true);
  };
  const openSimulator = () => {
    close();
    setIsSimulatorOpen(true);
  };

  const cofiState = cofiStateFor(guidance, urgentEvents.length > 0);

  return (
    <>
      <div className="pointer-events-none sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex w-full select-none justify-center px-2.5 sm:px-4">
        <div
          ref={islandRef}
          onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
          className={`pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExpanded
              ? "max-h-[86dvh] w-full max-w-3xl select-text overflow-y-auto overscroll-contain rounded-[28px] bg-[var(--sb-bg)] text-[var(--sb-text)] shadow-[0_24px_60px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.06]"
              : "flex h-10 max-w-[calc(100vw-1.25rem)] cursor-pointer items-center rounded-full border border-white/[0.14] bg-[#161618]/94 px-3.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-black/40 backdrop-blur-2xl hover:scale-[1.01] active:scale-[0.99] sm:max-w-lg sm:px-4"
          }`}
        >
          {!isExpanded ? (
            <CompactIsland
              state={cofiState}
              guidance={guidance}
              urgentCount={urgentEvents.length}
              currency={market?.currency || null}
              onOpen={() => setIsExpanded(true)}
            />
          ) : (
            <div className="animate-in fade-in duration-200 flex flex-col gap-3 p-3 sm:grid sm:grid-cols-[208px_minmax(0,1fr)] sm:grid-rows-[auto_auto_1fr] sm:gap-x-4 sm:p-4">
              {/* Cabeçalho do painel (Side Bar Header: título + subtítulo) */}
              <header className="flex items-start gap-3 px-3 pt-1 sm:col-start-1 sm:row-start-1">
                <Cofi state={cofiState} size={40} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[28px] font-bold leading-[1.15] tracking-[-0.02em]">Cofi</h2>
                  <p className="truncate text-[13px] text-[var(--sb-text-2)]">
                    {greetingForNow()}, {firstName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar painel do Cofi"
                  className="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sb-card)] text-[var(--sb-text-2)] outline-none hover:text-[var(--sb-text)] focus-visible:shadow-[var(--mac-focus-ring)] sm:hidden"
                >
                  <X size={16} />
                </button>
              </header>

              {/* Navegação (Side Bar Options): horizontal no celular, vertical no desktop */}
              <nav aria-label="Seções do painel" className="flex gap-1 overflow-x-auto no-scrollbar sm:col-start-1 sm:row-start-2 sm:flex-col sm:overflow-visible">
                <SideBarOption icon={<Sun size={20} />} label="Hoje" active={activeTab === "hoje"} onClick={() => setActiveTab("hoje")} />
                <SideBarOption icon={<CalendarDays size={20} />} label="Agenda" badge={upcomingEvents.length || undefined} active={activeTab === "agenda"} onClick={() => setActiveTab("agenda")} />
                <SideBarOption icon={<Globe2 size={20} />} label="Radar" live active={activeTab === "radar"} onClick={() => setActiveTab("radar")} />
              </nav>

              {/* Conteúdo da seção */}
              <section aria-label={activeTab === "hoje" ? "Hoje" : activeTab === "agenda" ? "Agenda" : "Radar"} className="min-w-0 sm:col-start-2 sm:row-span-3 sm:row-start-1">
                <div className="mb-2 hidden items-center justify-end sm:flex">
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Recolher Cofi"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sb-card)] text-[var(--sb-text-2)] outline-none hover:text-[var(--sb-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
                  >
                    <ChevronUp size={16} />
                  </button>
                </div>

                {activeTab === "hoje" && (
                  <TodayView
                    analytics={analytics}
                    guidance={guidance}
                    action={action}
                    urgentPayable={urgentEvents[0]?.id.startsWith("recurring_") ? urgentEvents[0] : undefined}
                    payingId={payingId}
                    onPay={payEvent}
                  />
                )}
                {activeTab === "agenda" && <AgendaView events={upcomingEvents} analytics={analytics} payingId={payingId} onPay={payEvent} onNavigate={close} />}
                {activeTab === "radar" && <RadarView market={market} loading={marketLoading} error={marketError} onRefresh={() => void loadMarket()} />}
              </section>

              {/* Atalhos (Side Bar Label + Options) */}
              <div className="sm:col-start-1 sm:row-start-3">
                <SideBarLabel>Atalhos</SideBarLabel>
                <div className="overflow-hidden rounded-[14px] bg-[var(--sb-card)] sm:bg-transparent">
                  <SideBarOption icon={<Zap size={20} />} label="Capturar gasto" onClick={openQuickCapture} block />
                  <SideBarOption icon={<Calculator size={20} />} label="Simular compra" onClick={openSimulator} block />
                  <SideBarOption icon={<MessageCircle size={20} />} label="Conversar" href="/ai" onClick={close} block />
                  <SideBarOption icon={<CalendarDays size={20} />} label="Calendário" href="/ai?view=calendar" onClick={close} block />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickCaptureModal isOpen={isQuickCaptureOpen} onClose={() => setIsQuickCaptureOpen(false)} />
      <PurchaseSimulatorModal isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Peças no estilo "Side Bar for iOS"                                  */
/* ------------------------------------------------------------------ */

function SideBarOption({
  icon,
  label,
  active,
  onClick,
  href,
  badge,
  live,
  block,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  badge?: number;
  live?: boolean;
  /** Linha inteira (lista de atalhos), com chevron e separador no celular. */
  block?: boolean;
}) {
  const className = `group flex min-h-[44px] shrink-0 items-center gap-3 rounded-[9px] px-3.5 py-2.5 text-left text-[15px] font-semibold outline-none transition-colors focus-visible:shadow-[var(--mac-focus-ring)] sm:text-[16px] ${
    block ? "w-full rounded-none border-b border-[var(--sb-sep)] last:border-b-0 sm:rounded-[9px] sm:border-b-0" : "sm:w-full"
  } ${active ? "bg-[var(--sb-brand)] text-white" : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"}`;
  const content = (
    <>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center ${active ? "text-white" : "text-[var(--sb-brand)]"}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof badge === "number" && (
        <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-[var(--sb-card)] text-[var(--sb-text-2)]"}`}>{badge}</span>
      )}
      {live && <span className={`h-2 w-2 rounded-full ${active ? "bg-white" : "bg-[var(--sb-good)]"} animate-pulse`} aria-label="ao vivo" />}
      {block && <ChevronRight size={16} className="text-[var(--sb-icon)] sm:hidden" aria-hidden />}
    </>
  );
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-pressed={block ? undefined : Boolean(active)}>
      {content}
    </button>
  );
}

function SideBarLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 pb-1.5 pt-3">
      <h3 className="min-w-0 flex-1 text-[19px] font-semibold tracking-[-0.01em] text-[var(--sb-text)]">{children}</h3>
      {action}
    </div>
  );
}

/** Lista agrupada (inset grouped) com separadores de 0,5px. */
function GroupedList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-[14px] bg-[var(--sb-card)]">{children}</ul>;
}

function ListRow({
  icon,
  iconTone = "brand",
  title,
  caption,
  value,
  valueTone,
  trailing,
}: {
  icon: React.ReactNode;
  iconTone?: "brand" | "good" | "warn" | "bad" | "muted";
  title: string;
  caption?: string;
  value?: string;
  valueTone?: "good" | "warn" | "bad";
  trailing?: React.ReactNode;
}) {
  const iconColors = {
    brand: "bg-[var(--sb-brand-bg)] text-[var(--sb-brand)]",
    good: "bg-[var(--sb-good-bg)] text-[var(--sb-good)]",
    warn: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]",
    bad: "bg-[var(--sb-bad-bg)] text-[var(--sb-bad)]",
    muted: "bg-[var(--sb-hover)] text-[var(--sb-icon)]",
  }[iconTone];
  const valueColor = valueTone ? { good: "text-[var(--sb-good)]", warn: "text-[var(--sb-warn)]", bad: "text-[var(--sb-bad)]" }[valueTone] : "text-[var(--sb-text)]";
  return (
    <li className="flex min-h-[52px] items-center gap-3 border-b border-[var(--sb-sep)] px-3.5 py-2.5 last:border-b-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${iconColors}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[15px] font-semibold leading-[1.3]">{title}</p>
        {caption && <p className="text-[12.5px] leading-[1.35] text-[var(--sb-text-2)]">{caption}</p>}
      </div>
      {value && <span className={`shrink-0 font-mono text-[15px] font-semibold tabular-nums ${valueColor}`}>{value}</span>}
      {trailing}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Seções                                                              */
/* ------------------------------------------------------------------ */

function TodayView({
  analytics: a,
  guidance,
  action,
  urgentPayable,
  payingId,
  onPay,
}: {
  analytics: FinancialAnalytics;
  guidance: SpendingGuidance;
  action: { tone: "warn" | "bad" | "good"; title: string; text: string };
  urgentPayable?: { id: string };
  payingId: string | null;
  onPay: (id: string) => void;
}) {
  const mode = MODE_LABEL[guidance.mode];
  const nextIn = a.timeline.events.find((e) => e.direction === "in");
  const nextOut = a.timeline.events.find((e) => e.direction === "out");
  const pace = a.spending.pacePercent;
  const actionTone = {
    good: "bg-[var(--sb-good-bg)] text-[var(--sb-good)]",
    warn: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]",
    bad: "bg-[var(--sb-bad-bg)] text-[var(--sb-bad)]",
  }[action.tone];

  return (
    <div className="space-y-3">
      {/* Orientação de gasto */}
      <div className="rounded-[18px] bg-[var(--sb-card)] p-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${mode.tone}`}>{mode.label}</span>
          <span className="text-[12px] text-[var(--sb-text-2)]">{guidance.untilLabel}</span>
        </div>
        <p className={`mt-2 text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] ${guidance.mode === "livre" ? "text-[var(--sb-text)]" : mode.text}`}>{guidance.headline}</p>
        <p className="mt-1.5 text-[14px] leading-[1.45] text-[var(--sb-text-2)]">{guidance.detail}</p>
      </div>

      {/* Ação recomendada agora */}
      <div className="flex items-start gap-3 rounded-[18px] bg-[var(--sb-card)] p-4">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${actionTone}`} aria-hidden>
          {action.tone === "good" ? <Lightbulb size={17} /> : <AlertTriangle size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--sb-text-2)]">Faça agora</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-[1.3]">{action.title}</p>
          <p className="mt-0.5 text-[14px] leading-[1.45] text-[var(--sb-text-2)]">{action.text}</p>
        </div>
        {urgentPayable && (
          <button
            type="button"
            onClick={() => onPay(urgentPayable.id)}
            disabled={payingId === urgentPayable.id}
            className="shrink-0 rounded-full bg-[var(--sb-brand)] px-3.5 py-2 text-[13px] font-semibold text-white outline-none disabled:opacity-50 focus-visible:shadow-[var(--mac-focus-ring)]"
          >
            {payingId === urgentPayable.id ? "Salvando…" : "Já paguei"}
          </button>
        )}
      </div>

      {/* Seu mês, em linhas simples */}
      <div>
        <SideBarLabel>Seu mês</SideBarLabel>
        <GroupedList>
          <ListRow icon={<Wallet size={16} />} title="Na conta hoje" caption="Saldo conciliado com seus lançamentos" value={brl(a.cash.balanceToday)} valueTone={a.cash.balanceToday < 0 ? "bad" : undefined} />
          <ListRow
            icon={<ArrowDownLeft size={16} />}
            iconTone="good"
            title="Ainda vai entrar"
            caption={nextIn ? `Próxima: ${nextIn.title}, dia ${nextIn.day}` : "Nenhuma entrada prevista"}
            value={brl(a.cash.toReceive)}
            valueTone="good"
          />
          <ListRow
            icon={<ArrowUpRight size={16} />}
            iconTone="warn"
            title="Ainda vai sair"
            caption={nextOut ? `Próxima: ${nextOut.title}, dia ${nextOut.day}` : "Nenhuma conta prevista"}
            value={brl(a.cash.toPay)}
          />
          <ListRow
            icon={<Flag size={16} />}
            iconTone={a.cash.projectedClose < 0 ? "bad" : a.target.gap < 0 ? "warn" : "good"}
            title={`Fecha ${a.monthName} com`}
            caption={a.target.gap >= 0 ? `${brl(a.target.gap, false)} acima da meta de ${brl(a.target.value, false)}` : `Faltam ${brl(-a.target.gap, false)} para a meta de ${brl(a.target.value, false)}`}
            value={brl(a.cash.projectedClose)}
            valueTone={a.cash.projectedClose < 0 ? "bad" : a.target.gap < 0 ? "warn" : "good"}
          />
          <ListRow
            icon={<ShoppingBag size={16} />}
            iconTone={pace !== null && pace >= 120 ? "warn" : "brand"}
            title="Gastos do dia a dia"
            caption={pace !== null ? `${pace}% do seu normal para esta altura do mês` : "Sem meses anteriores para comparar"}
            value={brl(a.spending.variableToDate)}
            valueTone={pace !== null && pace >= 120 ? "warn" : undefined}
          />
        </GroupedList>
        <p className="px-3 pt-2 text-[12px] leading-[1.4] text-[var(--sb-text-2)]">
          Fechamento = saldo de hoje + o que vai entrar − o que vai sair. É o mesmo cálculo da tela de Planejamento.
        </p>
      </div>
    </div>
  );
}

function AgendaView({
  events,
  analytics: a,
  payingId,
  onPay,
  onNavigate,
}: {
  events: ReturnType<typeof getUpcomingFinancialEvents>;
  analytics: FinancialAnalytics;
  payingId: string | null;
  onPay: (id: string) => void;
  onNavigate: () => void;
}) {
  return (
    <div className="space-y-3">
      <SideBarLabel
        action={
          <Link href="/ai?view=calendar" onClick={onNavigate} className="touch-target inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--sb-brand)] outline-none hover:underline focus-visible:underline">
            Calendário <ChevronRight size={15} />
          </Link>
        }
      >
        Próximos 7 dias
      </SideBarLabel>
      {events.length === 0 ? (
        <div className="rounded-[14px] bg-[var(--sb-card)] px-4 py-8 text-center text-[14px] text-[var(--sb-text-2)]">Nada vence nem entra nos próximos 7 dias.</div>
      ) : (
        <GroupedList>
          {events.map((event) => {
            const income = event.type === "planned_income";
            const when = event.daysRemaining === 0 ? "hoje" : event.daysRemaining === 1 ? "amanhã" : `em ${event.daysRemaining} dias`;
            return (
              <ListRow
                key={event.id}
                icon={income ? <ArrowDownLeft size={16} /> : event.type === "credit_invoice" ? <CreditCard size={16} /> : <Building2 size={16} />}
                iconTone={income ? "good" : event.isUrgent ? "warn" : "brand"}
                title={event.title}
                caption={`${event.dueDate} · ${when}`}
                value={`${income ? "+" : "−"} ${brl(event.amount)}`}
                valueTone={income ? "good" : undefined}
                trailing={
                  event.id.startsWith("recurring_") ? (
                    <button
                      type="button"
                      onClick={() => onPay(event.id)}
                      disabled={payingId === event.id}
                      className="touch-min shrink-0 rounded-full bg-[var(--sb-brand-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--sb-brand)] outline-none disabled:opacity-50 focus-visible:shadow-[var(--mac-focus-ring)]"
                    >
                      {payingId === event.id ? "…" : income ? "Recebi" : "Paguei"}
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </GroupedList>
      )}
      <GroupedList>
        <ListRow
          icon={<Landmark size={16} />}
          iconTone={a.target.gap >= 0 ? "good" : "warn"}
          title="Meta de fechamento"
          caption={`Meta de ${brl(a.target.value, false)} para o fim de ${a.monthName}`}
          value={a.target.gap >= 0 ? `Folga ${brl(a.target.gap)}` : `Faltam ${brl(-a.target.gap)}`}
          valueTone={a.target.gap >= 0 ? "good" : "warn"}
        />
      </GroupedList>
    </div>
  );
}

function RadarView({ market, loading, error, onRefresh }: { market: MarketBriefing | null; loading: boolean; error: boolean; onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <SideBarLabel
        action={
          <button type="button" onClick={onRefresh} disabled={loading} aria-label="Atualizar radar" className="touch-target flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sb-card)] text-[var(--sb-brand)] outline-none disabled:opacity-50 focus-visible:shadow-[var(--mac-focus-ring)]">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        }
      >
        Radar de mercado
      </SideBarLabel>
      <div className="grid grid-cols-2 gap-2">
        <QuoteCard label="Dólar comercial" symbol="USD/BRL" quote={market?.currency || null} kind="currency" loading={loading && !market} />
        <QuoteCard label="Bolsa brasileira" symbol="IBOV" quote={market?.index || null} kind="index" loading={loading && !market} />
      </div>
      <SideBarLabel>Notícias</SideBarLabel>
      {error && !market ? (
        <div className="rounded-[14px] bg-[var(--sb-card)] p-5 text-center text-[14px] text-[var(--sb-text-2)]">Não foi possível atualizar agora. Tente de novo em instantes.</div>
      ) : loading && !market ? (
        <div className="rounded-[14px] bg-[var(--sb-card)] p-5 text-center text-[14px] text-[var(--sb-text-2)]">Buscando o mercado…</div>
      ) : market?.news.length ? (
        <ul className="overflow-hidden rounded-[14px] bg-[var(--sb-card)]">
          {market.news.slice(0, 5).map((item) => (
            <li key={item.id} className="border-b border-[var(--sb-sep)] last:border-b-0">
              <a href={item.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-3.5 py-3 outline-none hover:bg-[var(--sb-hover)] focus-visible:bg-[var(--sb-hover)]">
                <Newspaper size={16} className="mt-0.5 shrink-0 text-[var(--sb-icon)]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[14px] font-medium leading-[1.35]">{item.title}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--sb-text-2)]">
                    {item.source}
                    {item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </span>
                </span>
                <ExternalLink size={14} className="mt-0.5 shrink-0 text-[var(--sb-icon)]" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-[14px] bg-[var(--sb-card)] p-5 text-center text-[14px] text-[var(--sb-text-2)]">Sem manchetes novas agora.</div>
      )}
      <p className="px-3 text-[12px] leading-[1.4] text-[var(--sb-text-2)]">Cotações informativas, sujeitas a atraso. O Cofi organiza contexto; não substitui recomendação de investimento.</p>
    </div>
  );
}

function QuoteCard({ label, symbol, quote, kind, loading }: { label: string; symbol: string; quote: MarketBriefing["currency"]; kind: "currency" | "index"; loading: boolean }) {
  const positive = (quote?.changePercent || 0) >= 0;
  return (
    <div className="rounded-[14px] bg-[var(--sb-card)] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-[var(--sb-text-2)]">{label}</span>
        <span className="font-mono text-[11px] text-[var(--sb-icon)]">{symbol}</span>
      </div>
      {loading ? (
        <div className="ai-skeleton mt-2 h-6 w-24" />
      ) : quote ? (
        <>
          <strong className="mt-1 block font-mono text-[18px] tabular-nums sm:text-[20px]">{formatQuote(quote.value, kind)}</strong>
          <span className={`mt-1 flex items-center gap-1 text-[12px] font-semibold ${positive ? "text-[var(--sb-good)]" : "text-[var(--sb-bad)]"}`}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
            {positive ? "+" : ""}
            {quote.changePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% hoje
          </span>
        </>
      ) : (
        <span className="mt-2 block text-[13px] text-[var(--sb-text-2)]">Indisponível</span>
      )}
    </div>
  );
}

function CompactIsland({
  state,
  guidance,
  urgentCount,
  currency,
  onOpen,
}: {
  state: CofiState;
  guidance: SpendingGuidance;
  urgentCount: number;
  currency: MarketBriefing["currency"];
  onOpen: () => void;
}) {
  const valueColor = guidance.mode === "livre" ? "text-emerald-300" : guidance.mode === "pausa" ? "text-rose-300" : "text-amber-300";
  return (
    <button type="button" onClick={onOpen} aria-label={`Abrir painel do Cofi. Hoje: ${guidance.headline}`} className="flex h-10 w-full items-center justify-between gap-2 text-left outline-none sm:gap-3">
      <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Cofi state={state} size={24} />
        <span className="hidden text-xs font-semibold sm:inline">Cofi</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-[10px] text-white/50">Hoje</span>
        <strong className={`truncate font-mono text-[11px] sm:text-xs ${valueColor}`}>{guidance.short}</strong>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {urgentCount > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/20 px-2 py-0.5 text-[9px] font-semibold text-amber-300 sm:text-[10px]">
            <AlertTriangle size={9} />
            {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
          </span>
        ) : currency ? (
          <span className="hidden items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] text-white/65 sm:inline-flex">
            <Globe2 size={9} className="text-cyan-300" />
            USD {currency.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : null}
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/60" aria-hidden>
          <ChevronDown size={12} />
        </span>
      </span>
    </button>
  );
}
