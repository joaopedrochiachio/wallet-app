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
  CreditCard,
  Lightbulb,
  MessageCircle,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { getBestCardToSpendToday, getUpcomingFinancialEvents } from "@/lib/services/dailyCompanionService";
import { useMonthAnalytics } from "@/lib/hooks/useMonthAnalytics";
import type { FinancialAnalytics } from "@/lib/services/financialAnalyticsService";
import type { GuidanceMode, SpendingGuidance } from "@/lib/services/spendingGuidance";
import { buildCashSeries } from "@/lib/services/moneyViews";
import type { MarketBriefing } from "@/types/market";
import { Cofi, type CofiState } from "@/components/assistant/Cofi";
import { CashSparkline } from "@/components/ai/money/CashFlowChart";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import { QuickCaptureModal } from "./QuickCaptureModal";

/**
 * Painel do Cofi (ilha no topo), no estilo Central de Controle do iPhone.
 * Fechado: uma pílula com a orientação do dia. Aberto: o fechamento do mês com
 * a curva do saldo, três blocos (hoje, entra, sai), a ação de agora, os
 * próximos 7 dias e atalhos. Os números vêm da mesma análise que a IA usa.
 */

const brl = (value: number, cents = true) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const plain = (value: number) => Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const MODE_LABEL: Record<GuidanceMode, { label: string; tone: string }> = {
  livre: { label: "Dá para gastar", tone: "bg-[var(--sb-good-bg)] text-[var(--sb-good)]" },
  contido: { label: "Gasto contido", tone: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]" },
  essencial: { label: "Só o essencial", tone: "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]" },
  pausa: { label: "Pausa nos gastos", tone: "bg-[var(--sb-bad-bg)] text-[var(--sb-bad)]" },
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
    return { tone: "bad", title: "O mês fecha no negativo", text: `Mesmo com o que vai entrar, faltam ${brl(-a.cash.projectedClose)}. Corte o que pode esperar.` };
  }
  if (a.timeline.negativeFromDay !== null && a.timeline.recoveryIncome) {
    const bill = a.timeline.events.find((e) => e.direction === "out" && e.day === a.timeline.negativeFromDay);
    return {
      tone: "warn",
      title: `Dinheiro curto no dia ${a.timeline.negativeFromDay}`,
      text: `${bill ? `${bill.title} (${brl(bill.amount)}) vence` : "Uma conta vence"} antes de ${a.timeline.recoveryIncome.title} (dia ${a.timeline.recoveryIncome.day}). Separe ${brl(-a.timeline.lowestBalance)} até lá.`,
    };
  }
  if (a.target.gap < 0) {
    return { tone: "warn", title: "Meta do mês em risco", text: `Faltam ${brl(-a.target.gap)} para a meta. Segure compras novas até o fim do mês.` };
  }
  if (a.spending.biggestIncrease) {
    const c = a.spending.biggestIncrease;
    return { tone: "warn", title: `${c.category} acima do normal`, text: `${brl(c.monthToDate)} até hoje, contra ${brl(c.samePeriodAverage ?? 0)} na sua média.` };
  }
  if (bestCard) {
    return { tone: "good", title: "Tudo em ordem", text: `No crédito, ${bestCard.cardName} dá o maior prazo agora (${brl(bestCard.availableLimit)} livres).` };
  }
  return { tone: "good", title: "Tudo em ordem", text: "Nenhuma urgência. Siga a orientação de gasto do dia." };
}

export function DynamicIsland() {
  const { userProfile, cards, recurringItems, transactions, getMonthlyProjection, realizeRecurringItemNow } = useWallet();
  const { analytics, guidance } = useMonthAnalytics();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketBriefing | null>(null);
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
  const series = useMemo(() => buildCashSeries(analytics), [analytics]);
  const firstName = (userProfile.name || "você").split(" ")[0];
  const action = recommendedAction({ analytics, guidance, urgent: urgentEvents[0], bestCard });

  // Cotações só quando o painel abre (rodapé discreto)
  const loadMarket = useCallback(async () => {
    try {
      const response = await fetch("/api/market/briefing", { cache: "no-store" });
      if (response.ok) setMarket((await response.json()) as MarketBriefing);
    } catch {
      /* rodapé opcional: sem cotação, nada aparece */
    }
  }, []);
  useEffect(() => {
    if (!isExpanded || market) return;
    const t = window.setTimeout(() => void loadMarket(), 0);
    return () => window.clearTimeout(t);
  }, [isExpanded, market, loadMarket]);

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
  const cofiState = cofiStateFor(guidance, urgentEvents.length > 0);
  const a = analytics;
  const closeTone = a.cash.projectedClose < 0 ? "text-[var(--sb-bad)]" : a.target.gap < 0 ? "text-[var(--sb-warn)]" : "text-[var(--sb-good)]";
  const nextIn = a.timeline.events.find((e) => e.direction === "in");
  const nextOut = a.timeline.events.find((e) => e.direction === "out");
  const urgentPayable = urgentEvents[0]?.id.startsWith("recurring_") ? urgentEvents[0] : undefined;

  return (
    <>
      <div className="pointer-events-none sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex w-full select-none justify-center px-2.5 sm:px-4">
        <div
          ref={islandRef}
          onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
          className={`pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isExpanded
              ? "max-h-[86dvh] w-full max-w-[420px] select-text overflow-y-auto overscroll-contain rounded-[30px] bg-[var(--sb-bg)] text-[var(--sb-text)] shadow-[0_24px_60px_rgba(0,0,0,0.24)] ring-1 ring-black/[0.06]"
              : "flex h-10 max-w-[calc(100vw-1.25rem)] cursor-pointer items-center rounded-full border border-white/[0.14] bg-[#161618]/94 px-3 text-white shadow-[0_12px_40px_rgba(0,0,0,0.16)] ring-1 ring-black/40 backdrop-blur-2xl hover:scale-[1.01] active:scale-[0.99] sm:max-w-sm sm:px-3.5"
          }`}
        >
          {!isExpanded ? (
            <CompactIsland state={cofiState} guidance={guidance} urgentCount={urgentEvents.length} onOpen={() => setIsExpanded(true)} />
          ) : (
            <div className="space-y-2.5 p-3">
              {/* Cabeçalho */}
              <header className="flex items-center gap-2.5 px-1 pt-0.5">
                <Cofi state={cofiState} size={30} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">Cofi</h2>
                  <p className="truncate text-[12px] text-[var(--sb-text-2)]">
                    {greetingForNow()}, {firstName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar painel do Cofi"
                  className="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sb-card)] text-[var(--sb-text-2)] outline-none hover:text-[var(--sb-text)] focus-visible:shadow-[var(--mac-focus-ring)]"
                >
                  <X size={15} />
                </button>
              </header>

              {/* Fechamento + curva do saldo */}
              <Link
                href="/ai"
                onClick={close}
                className="block rounded-[22px] bg-[var(--sb-card)] p-4 outline-none focus-visible:shadow-[var(--mac-focus-ring)]"
                aria-label={`Fecha ${a.monthName} com ${brl(a.cash.projectedClose)}. Abrir a análise completa`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] text-[var(--sb-text-2)]">Fecha {a.monthName} com</p>
                    <p className="mt-0.5 text-[26px] font-semibold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]">{brl(a.cash.projectedClose)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODE_LABEL[guidance.mode].tone}`}>{MODE_LABEL[guidance.mode].label}</span>
                </div>
                <div className={`mt-3 ${closeTone}`}>
                  <CashSparkline series={series} width={360} height={40} />
                </div>
                <p className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[var(--sb-text-2)]">
                  <span className="truncate">
                    {guidance.headline} · {guidance.untilLabel}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-[var(--sb-icon)]" aria-hidden />
                </p>
              </Link>

              {/* Três blocos: hoje, entra, sai */}
              <div className="grid grid-cols-3 gap-2">
                <Tile icon={<Wallet size={14} />} label="Hoje" value={plain(a.cash.balanceToday)} negative={a.cash.balanceToday < 0} />
                <Tile icon={<ArrowDownLeft size={14} />} label="Entra" value={plain(a.cash.toReceive)} caption={nextIn ? `dia ${nextIn.day}` : undefined} tone="good" />
                <Tile icon={<ArrowUpRight size={14} />} label="Sai" value={plain(a.cash.toPay)} caption={nextOut ? `dia ${nextOut.day}` : undefined} />
              </div>

              {/* Agora */}
              <div className="flex items-start gap-3 rounded-[22px] bg-[var(--sb-card)] p-3.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    action.tone === "good" ? "bg-[var(--sb-good-bg)] text-[var(--sb-good)]" : action.tone === "bad" ? "bg-[var(--sb-bad-bg)] text-[var(--sb-bad)]" : "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]"
                  }`}
                  aria-hidden
                >
                  {action.tone === "good" ? <Lightbulb size={16} /> : <AlertTriangle size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold leading-[1.3]">{action.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-[1.4] text-[var(--sb-text-2)]">{action.text}</p>
                </div>
                {urgentPayable && (
                  <button
                    type="button"
                    onClick={() => void payEvent(urgentPayable.id)}
                    disabled={payingId === urgentPayable.id}
                    className="shrink-0 rounded-full bg-[var(--sb-brand)] px-3 py-1.5 text-[12px] font-semibold text-white outline-none disabled:opacity-50 focus-visible:shadow-[var(--mac-focus-ring)]"
                  >
                    {payingId === urgentPayable.id ? "Salvando…" : "Já paguei"}
                  </button>
                )}
              </div>

              {/* Próximos 7 dias */}
              <section aria-label="Próximos 7 dias" className="rounded-[22px] bg-[var(--sb-card)] px-3.5 pb-1 pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Próximos 7 dias</h3>
                  <Link href="/ai?view=calendar" onClick={close} className="touch-target inline-flex items-center gap-0.5 text-[12px] font-semibold text-[var(--sb-brand)] outline-none hover:underline focus-visible:underline">
                    Calendário <ChevronRight size={13} />
                  </Link>
                </div>
                {upcomingEvents.length === 0 ? (
                  <p className="py-3 text-[12.5px] text-[var(--sb-text-2)]">Nada vence nem entra nos próximos 7 dias.</p>
                ) : (
                  <ul className="mt-1">
                    {upcomingEvents.slice(0, 4).map((event) => {
                      const income = event.type === "planned_income";
                      const when = event.daysRemaining === 0 ? "hoje" : event.daysRemaining === 1 ? "amanhã" : `em ${event.daysRemaining} dias`;
                      return (
                        <li key={event.id} className="flex min-h-[44px] items-center gap-2.5 border-t border-[var(--sb-sep)] py-1.5 first:border-t-0">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${income ? "bg-[var(--sb-good-bg)] text-[var(--sb-good)]" : event.isUrgent ? "bg-[var(--sb-warn-bg)] text-[var(--sb-warn)]" : "bg-[var(--sb-brand-bg)] text-[var(--sb-brand)]"}`} aria-hidden>
                            {income ? <ArrowDownLeft size={12} /> : event.type === "credit_invoice" ? <CreditCard size={12} /> : <Building2 size={12} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium">{event.title}</span>
                            <span className="block text-[11px] text-[var(--sb-text-2)]">{when}</span>
                          </span>
                          <span className={`shrink-0 font-mono text-[12.5px] tabular-nums ${income ? "text-[var(--sb-good)]" : ""}`}>
                            {income ? "+" : "−"}
                            {plain(event.amount)}
                          </span>
                          {event.id.startsWith("recurring_") && (
                            <button
                              type="button"
                              onClick={() => void payEvent(event.id)}
                              disabled={payingId === event.id}
                              className="touch-min shrink-0 rounded-full bg-[var(--sb-brand-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--sb-brand)] outline-none disabled:opacity-50 focus-visible:shadow-[var(--mac-focus-ring)]"
                            >
                              {payingId === event.id ? "…" : income ? "Recebi" : "Paguei"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Atalhos (botões redondos da Central de Controle) */}
              <nav aria-label="Atalhos do Cofi" className="grid grid-cols-4 gap-1 pt-1">
                <Control icon={<Zap size={19} />} label="Capturar gasto" short="Capturar" onClick={() => { close(); setIsQuickCaptureOpen(true); }} />
                <Control icon={<Calculator size={19} />} label="Simular compra" short="Simular" onClick={() => { close(); setIsSimulatorOpen(true); }} />
                <Control icon={<MessageCircle size={19} />} label="Conversar" short="Conversar" href="/ai" onClick={close} />
                <Control icon={<CalendarDays size={19} />} label="Calendário" short="Calendário" href="/ai?view=calendar" onClick={close} />
              </nav>

              {(market?.currency || market?.index) && (
                <p className="px-1 pb-0.5 text-center font-mono text-[10.5px] text-[var(--sb-text-2)]">
                  {market.currency && <Quote label="USD" value={market.currency.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} change={market.currency.changePercent} />}
                  {market.currency && market.index && <span className="mx-2 opacity-50">·</span>}
                  {market.index && <Quote label="IBOV" value={Math.round(market.index.value).toLocaleString("pt-BR")} change={market.index.changePercent} />}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <QuickCaptureModal isOpen={isQuickCaptureOpen} onClose={() => setIsQuickCaptureOpen(false)} />
      <PurchaseSimulatorModal isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} />
    </>
  );
}

function Quote({ label, value, change }: { label: string; value: string; change: number }) {
  return (
    <span>
      {label} {value}{" "}
      <span className={change >= 0 ? "text-[var(--sb-good)]" : "text-[var(--sb-bad)]"}>
        {change >= 0 ? "+" : ""}
        {change.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
      </span>
    </span>
  );
}

function Tile({ icon, label, value, caption, tone, negative }: { icon: React.ReactNode; label: string; value: string; caption?: string; tone?: "good"; negative?: boolean }) {
  return (
    <div className="min-w-0 rounded-[18px] bg-[var(--sb-card)] px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] text-[var(--sb-text-2)]">
        <span className={tone === "good" ? "text-[var(--sb-good)]" : "text-[var(--sb-icon)]"} aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p className={`mt-1 truncate font-mono text-[13px] font-semibold tabular-nums ${negative ? "text-[var(--sb-bad)]" : tone === "good" ? "text-[var(--sb-good)]" : ""}`}>
        {negative ? "−" : ""}
        {value}
      </p>
      {caption && <p className="text-[10.5px] text-[var(--sb-text-2)]">{caption}</p>}
    </div>
  );
}

function Control({ icon, label, short, onClick, href }: { icon: React.ReactNode; label: string; short: string; onClick: () => void; href?: string }) {
  const inner = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sb-card)] text-[var(--sb-brand)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-transform group-active:scale-95" aria-hidden>
        {icon}
      </span>
      <span className="mt-1 block text-center text-[11px] font-medium text-[var(--sb-text-2)]">{short}</span>
    </>
  );
  const className = "group flex flex-col items-center rounded-[14px] py-1 outline-none focus-visible:shadow-[var(--mac-focus-ring)]";
  return href ? (
    <Link href={href} onClick={onClick} aria-label={label} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {inner}
    </button>
  );
}

function CompactIsland({ state, guidance, urgentCount, onOpen }: { state: CofiState; guidance: SpendingGuidance; urgentCount: number; onOpen: () => void }) {
  const valueColor = guidance.mode === "livre" ? "text-emerald-300" : guidance.mode === "pausa" ? "text-rose-300" : "text-amber-300";
  return (
    <button type="button" onClick={onOpen} aria-label={`Abrir painel do Cofi. Hoje: ${guidance.headline}`} className="flex h-10 w-full items-center gap-2 text-left outline-none">
      <Cofi state={state} size={24} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="text-[11px] text-white/55">Hoje</span>
        <strong className={`truncate font-mono text-[12px] ${valueColor}`}>{guidance.short}</strong>
      </span>
      {urgentCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          <AlertTriangle size={9} />
          {urgentCount}
        </span>
      )}
      <ChevronDown size={14} className="shrink-0 text-white/55" aria-hidden />
    </button>
  );
}
