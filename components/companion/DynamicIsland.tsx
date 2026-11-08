"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Calculator,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ExternalLink,
  Globe2,
  MessageCircle,
  Newspaper,
  PencilLine,
  RefreshCw,
  Target,
  Zap,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import {
  calculateCheckInStreak,
  calculateDailySafeSpend,
  generateDailyCompanionAdvice,
  getBestCardToSpendToday,
  getDailyCheckIns,
  getUpcomingFinancialEvents,
  saveDailyCheckIn,
} from "@/lib/services/dailyCompanionService";
import type { MarketBriefing } from "@/types/market";
import { AgentAvatar, type AgentAvatarState } from "./AgentAvatar";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import { QuickCaptureModal } from "./QuickCaptureModal";

type ActiveTab = "hoje" | "agenda" | "radar";
type CheckInMood = "in_control" | "unexpected_spend" | "tight_savings";

const FOCUS_STORAGE_KEY = "wallet_niko_daily_focus_v1";

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuote(value: number, kind: "currency" | "index") {
  if (kind === "currency") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4 });
  }
  return Math.round(value).toLocaleString("pt-BR");
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function DynamicIsland() {
  const {
    userProfile,
    cards,
    recurringItems,
    transactions,
    mainBalance,
    monthExpense,
    getMonthlyProjection,
    realizeRecurringItemNow,
  } = useWallet();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("hoje");
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState(() => getDailyCheckIns());
  const [personalFocus, setPersonalFocus] = useState("");
  const [focusSaved, setFocusSaved] = useState(false);
  const [market, setMarket] = useState<MarketBriefing | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState(false);
  const islandRef = useRef<HTMLDivElement>(null);

  const currentMonthProjection = getMonthlyProjection(0);
  const projectedFreeBalance =
    currentMonthProjection?.projectedFreeBalance ?? mainBalance - monthExpense;
  const targetEndMonthBalance = userProfile?.targetMonthEndBalance || 700;
  const safeSpend = useMemo(
    () =>
      calculateDailySafeSpend({
        projectedFreeBalance,
        targetEndMonthBalance,
      }),
    [projectedFreeBalance, targetEndMonthBalance]
  );

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
  const urgentEvents = upcomingEvents.filter((event) => event.isUrgent);
  const nextEvent = upcomingEvents[0];
  const { streak } = useMemo(() => calculateCheckInStreak(checkIns), [checkIns]);
  const bestCard = useMemo(() => getBestCardToSpendToday({ cards }), [cards]);
  const firstName = (userProfile.name || "você").split(" ")[0];
  const gapToTarget = Math.max(0, targetEndMonthBalance - projectedFreeBalance);

  const advice = useMemo(
    () =>
      generateDailyCompanionAdvice({
        userName: userProfile.name,
        projectedFreeBalance,
        targetEndMonthBalance,
        safeDailyAllowance: safeSpend.safeDailyAllowance,
        upcomingEventsCount: upcomingEvents.length,
        streakCount: streak,
        persona: userProfile.persona || "guardian",
      }),
    [
      userProfile.name,
      userProfile.persona,
      projectedFreeBalance,
      targetEndMonthBalance,
      safeSpend.safeDailyAllowance,
      upcomingEvents.length,
      streak,
    ]
  );

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

  const activeMood = useMemo(() => {
    const todayCheckIn = checkIns.find((record) => record.date === localDateKey());
    return (todayCheckIn?.mood as CheckInMood | undefined) || null;
  }, [checkIns]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(FOCUS_STORAGE_KEY) || "{}") as {
          date?: string;
          value?: string;
        };
        if (stored.date === localDateKey()) setPersonalFocus(stored.value || "");
      } catch {
        setPersonalFocus("");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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

  const saveFocus = () => {
    const value = personalFocus.trim().slice(0, 100);
    setPersonalFocus(value);
    try {
      window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify({ date: localDateKey(), value }));
      setFocusSaved(true);
      window.setTimeout(() => setFocusSaved(false), 1600);
    } catch {
      setFocusSaved(false);
    }
  };

  const performCheckIn = (mood: CheckInMood) => {
    const saved = saveDailyCheckIn(mood);
    setCheckIns(getDailyCheckIns());
    void saved;
  };

  const payEvent = async (eventId: string) => {
    const recurringItemId = eventId.replace("recurring_", "");
    const item = recurringItems.find((candidate) => candidate.id === recurringItemId);
    if (!item) return;
    setPayingId(eventId);
    try {
      const now = new Date();
      await realizeRecurringItemNow(item, now.getFullYear(), now.getMonth());
    } finally {
      setPayingId(null);
    }
  };

  const openQuickCapture = () => {
    setIsExpanded(false);
    setIsQuickCaptureOpen(true);
  };

  const openSimulator = () => {
    setIsExpanded(false);
    setIsSimulatorOpen(true);
  };

  return (
    <>
      <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 w-full flex justify-center px-2.5 sm:px-4 pointer-events-none select-none">
        <div
          ref={islandRef}
          onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
          className={`pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.16)] ${
            isExpanded
              ? "w-full max-w-2xl max-h-[86dvh] overflow-y-auto rounded-[28px] sm:rounded-[32px] bg-white/98 text-[#1D1D1F] p-4 sm:p-5 border-black/[0.07] ring-1 ring-black/[0.04]"
              : "h-10 px-3.5 sm:px-4 rounded-full bg-[#161618]/94 hover:bg-[#161618] text-white flex items-center cursor-pointer hover:scale-[1.01] active:scale-[0.99] max-w-[calc(100vw-1.25rem)] sm:max-w-lg border-white/[0.14] ring-1 ring-black/40"
          }`}
        >
          {!isExpanded ? (
            <CompactIsland
              adviceState={advice.avatarState}
              persona={userProfile.persona || "guardian"}
              safeAllowance={safeSpend.safeDailyAllowance}
              urgentCount={urgentEvents.length}
              currency={market?.currency || null}
            />
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-black/[0.06] pb-3 gap-2">
                <div className="flex items-center gap-1 bg-[#F2F2F7] p-1 rounded-full text-xs font-medium">
                  <TabButton label="Hoje" active={activeTab === "hoje"} onClick={() => setActiveTab("hoje")} />
                  <TabButton label="Agenda" count={upcomingEvents.length} active={activeTab === "agenda"} onClick={() => setActiveTab("agenda")} />
                  <TabButton label="Radar" live active={activeTab === "radar"} onClick={() => setActiveTab("radar")} />
                </div>
                <button type="button" onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#636366] flex items-center justify-center cursor-pointer" aria-label="Recolher Niko">
                  <ChevronUp size={14} />
                </button>
              </div>

              {activeTab === "hoje" && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="rounded-2xl bg-gradient-to-br from-[#FAFAFC] to-white border border-black/[0.06] p-4 flex items-start gap-3.5">
                    <AgentAvatar persona={userProfile.persona || "guardian"} state={advice.avatarState} size="lg" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase tracking-[0.14em] text-blue-600 font-bold">{greetingForNow()}, {firstName} · Niko está atento</span>
                      <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F] mt-1">{advice.headline}</h3>
                      <p className="text-xs text-[#86868B] leading-relaxed mt-1">{advice.advice}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <MiniMetric label="Livre hoje" value={`R$ ${formatCurrency(safeSpend.safeDailyAllowance)}`} tone="emerald" />
                    <MiniMetric label="Fecha o mês" value={`R$ ${formatCurrency(projectedFreeBalance)}`} tone={gapToTarget > 0 ? "amber" : "blue"} />
                    <MiniMetric label="Próximo evento" value={nextEvent ? `${nextEvent.daysRemaining === 0 ? "Hoje" : `${nextEvent.daysRemaining}d`} · R$ ${formatCurrency(nextEvent.amount)}` : "Agenda livre"} tone="white" />
                  </div>

                  <div className={`rounded-2xl border p-3.5 ${urgentEvents.length > 0 || gapToTarget > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {urgentEvents.length > 0 || gapToTarget > 0 ? <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />}
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-[#86868B]">Ação recomendada agora</span>
                          <p className="text-xs text-[#1D1D1F] mt-0.5 leading-relaxed">
                            {urgentEvents.length > 0
                              ? `${urgentEvents[0].title} vence ${urgentEvents[0].daysRemaining === 0 ? "hoje" : "amanhã"}. Garanta R$ ${formatCurrency(urgentEvents[0].amount)} na conta.`
                              : gapToTarget > 0
                                ? `Proteja R$ ${formatCurrency(gapToTarget)} até o fechamento. Evite uma nova compra fora do planejado hoje.`
                                : bestCard
                                  ? `${bestCard.cardName} oferece o melhor prazo agora, com R$ ${formatCurrency(bestCard.availableLimit)} de limite disponível.`
                                  : "Nenhuma urgência detectada. Você pode seguir o teto diário sem pressionar a meta."}
                          </p>
                        </div>
                      </div>
                      {urgentEvents[0]?.id.startsWith("recurring_") && (
                        <button type="button" onClick={() => void payEvent(urgentEvents[0].id)} disabled={payingId === urgentEvents[0].id} className="px-2.5 py-1.5 rounded-xl bg-[#1D1D1F] text-white text-[10px] font-bold shrink-0 disabled:opacity-50 cursor-pointer">
                          {payingId === urgentEvents[0].id ? "Salvando" : "Dar baixa"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <ActionButton icon={<Zap size={13} />} label="Capturar gasto" onClick={openQuickCapture} tone="amber" />
                    <ActionButton icon={<Calculator size={13} />} label="Simular compra" onClick={openSimulator} tone="violet" />
                    <Link href="/ai" onClick={() => setIsExpanded(false)} className="rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-2.5 text-[10px] sm:text-xs font-semibold text-blue-700 flex items-center justify-center gap-1.5">
                      <MessageCircle size={13} />Conversar
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === "agenda" && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">Próximos 7 dias</h3>
                      <p className="text-[11px] text-[#86868B]">Contas, faturas e entradas previstas em ordem de prioridade.</p>
                    </div>
                    <Link href="/ai?view=calendar" onClick={() => setIsExpanded(false)} className="px-3 py-1.5 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[10px] font-semibold flex items-center gap-1.5 shrink-0">
                      <CalendarClock size={12} />Calendário completo
                    </Link>
                  </div>
                  {upcomingEvents.length === 0 ? (
                    <div className="py-8 rounded-2xl bg-[#FAFAFC] border border-black/[0.06] text-center">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                      <p className="text-xs text-[#636366] mt-2">Agenda livre nos próximos 7 dias.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[330px] overflow-y-auto no-scrollbar">
                      {upcomingEvents.map((event) => (
                        <div key={event.id} className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${event.isUrgent ? "bg-amber-50 border-amber-200" : "bg-[#FAFAFC] border-black/[0.06]"}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${event.type === "planned_income" ? "bg-emerald-50 text-emerald-600" : event.type === "credit_invoice" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}>
                              {event.type === "planned_income" ? <ArrowDownLeft size={15} /> : event.type === "credit_invoice" ? <CreditCard size={15} /> : <Building2 size={15} />}
                            </div>
                            <div className="min-w-0">
                              <strong className="block text-xs font-semibold truncate">{event.title}</strong>
                              <span className="text-[10px] text-[#86868B]">{event.dueDate} · {event.daysRemaining === 0 ? "hoje" : event.daysRemaining === 1 ? "amanhã" : `em ${event.daysRemaining} dias`}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <strong className={`font-mono text-xs ${event.type === "planned_income" ? "text-emerald-600" : "text-[#1D1D1F]"}`}>{event.type === "planned_income" ? "+" : "−"}R$ {formatCurrency(event.amount)}</strong>
                            {event.id.startsWith("recurring_") && (
                              <button type="button" onClick={() => void payEvent(event.id)} disabled={payingId === event.id} className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold cursor-pointer disabled:opacity-50">
                                {payingId === event.id ? "..." : event.type === "planned_income" ? "Receber" : "Baixar"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.06] p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Target size={14} className="text-blue-600" /><span className="text-[11px] text-[#636366]">Meta de fechamento</span></div>
                    <strong className={`font-mono text-xs ${gapToTarget > 0 ? "text-amber-700" : "text-emerald-700"}`}>{gapToTarget > 0 ? `Faltam R$ ${formatCurrency(gapToTarget)}` : `Folga R$ ${formatCurrency(projectedFreeBalance - targetEndMonthBalance)}`}</strong>
                  </div>
                </div>
              )}

              {activeTab === "radar" && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5"><Globe2 size={14} className="text-blue-600" /><h3 className="text-sm font-bold">Radar de mercado</h3></div>
                      <p className="text-[11px] text-[#86868B]">Câmbio, bolsa e manchetes que podem mexer com o seu dinheiro.</p>
                    </div>
                    <button type="button" onClick={() => void loadMarket()} disabled={marketLoading} className="w-8 h-8 rounded-xl bg-[#F2F2F7] hover:bg-[#E5E5EA] flex items-center justify-center cursor-pointer disabled:opacity-50" aria-label="Atualizar radar">
                      <RefreshCw size={13} className={marketLoading ? "animate-spin" : ""} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <QuoteCard label="Dólar comercial" symbol="USD/BRL" quote={market?.currency || null} kind="currency" loading={marketLoading && !market} />
                    <QuoteCard label="Bolsa brasileira" symbol="IBOV" quote={market?.index || null} kind="index" loading={marketLoading && !market} />
                  </div>

                  <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.06] overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-black/[0.06] flex items-center gap-2">
                      <Newspaper size={13} className="text-violet-600" />
                      <span className="text-xs font-semibold">Notícias do mercado</span>
                      <span className="ml-auto text-[9px] text-[#86868B]">últimas 24h</span>
                    </div>
                    {marketError && !market ? (
                      <div className="p-5 text-center text-xs text-[#86868B]">Não foi possível atualizar o radar agora. Tente novamente em instantes.</div>
                    ) : marketLoading && !market ? (
                      <div className="p-5 text-center text-xs text-[#86868B]">Buscando o mercado...</div>
                    ) : market?.news.length ? (
                      <div className="divide-y divide-black/[0.06] max-h-[260px] overflow-y-auto no-scrollbar">
                        {market.news.slice(0, 5).map((item) => (
                          <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="p-3.5 flex items-start justify-between gap-3 hover:bg-[#F2F2F7] transition-colors">
                            <div className="min-w-0">
                              <strong className="text-xs font-medium text-[#1D1D1F] leading-snug line-clamp-2">{item.title}</strong>
                              <span className="text-[9px] text-[#86868B] mt-1 block">{item.source}{item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
                            </div>
                            <ExternalLink size={11} className="text-[#AEAEB2] mt-0.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="p-5 text-center text-xs text-[#86868B]">Sem manchetes novas neste momento.</div>
                    )}
                  </div>
                  <p className="text-[9px] text-[#86868B] leading-relaxed">Cotações informativas, sujeitas a atraso. O Niko organiza contexto; não substitui recomendação de investimento.</p>
                </div>
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

function CompactIsland({ adviceState, persona, safeAllowance, urgentCount, currency }: { adviceState: AgentAvatarState; persona: string; safeAllowance: number; urgentCount: number; currency: MarketBriefing["currency"] }) {
  return (
    <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <AgentAvatar persona={persona} state={adviceState} size="sm" showBadge={false} />
        <span className="text-xs font-semibold hidden sm:inline">Niko</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] text-white/45">Livre hoje</span>
        <strong className="text-[11px] sm:text-xs font-mono text-emerald-300 truncate">R$ {formatCurrency(safeAllowance)}</strong>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {urgentCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/25"><AlertTriangle size={9} />{urgentCount} urgente{urgentCount > 1 ? "s" : ""}</span>
        ) : currency ? (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-white/65 px-2 py-0.5 rounded-full bg-white/[0.07]"><Globe2 size={9} className="text-cyan-300" />USD {currency.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        ) : null}
        <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/60"><ChevronDown size={12} /></div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, count, live }: { label: string; active: boolean; onClick: () => void; count?: number; live?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 sm:px-3.5 py-1 rounded-full transition-all cursor-pointer text-[11px] sm:text-xs flex items-center gap-1.5 ${active ? "bg-[#1D1D1F] text-white font-semibold shadow-sm" : "text-[#86868B] hover:text-[#1D1D1F]"}`}>
      {label}
      {typeof count === "number" && count > 0 && <span className={`text-[9px] px-1.5 rounded-full ${active ? "bg-white/15" : "bg-amber-100 text-amber-800"}`}>{count}</span>}
      {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
    </button>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "blue" | "white" }) {
  const colors = { emerald: "text-emerald-700", amber: "text-amber-700", blue: "text-blue-700", white: "text-[#1D1D1F]" };
  return <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.06] p-2.5 min-w-0"><span className="text-[9px] text-[#86868B] block truncate">{label}</span><strong className={`text-[10px] sm:text-xs font-mono block mt-1 truncate ${colors[tone]}`}>{value}</strong></div>;
}

function MoodButton({ label, color, active, onClick }: { label: string; color: "emerald" | "amber" | "blue"; active: boolean; onClick: () => void }) {
  const activeColors = { emerald: "bg-emerald-50 border-emerald-300 text-emerald-700", amber: "bg-amber-50 border-amber-300 text-amber-700", blue: "bg-blue-50 border-blue-300 text-blue-700" };
  const dots = { emerald: "bg-emerald-400", amber: "bg-amber-400", blue: "bg-blue-400" };
  return <button type="button" onClick={onClick} className={`rounded-xl border py-1.5 px-1 text-[9px] sm:text-[10px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${active ? activeColors[color] : "bg-white border-black/[0.06] text-[#86868B]"}`}><span className={`w-1.5 h-1.5 rounded-full ${dots[color]}`} />{label}</button>;
}

function ActionButton({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone: "amber" | "violet" }) {
  const colors = tone === "amber" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-violet-50 border-violet-200 text-violet-700";
  return <button type="button" onClick={onClick} className={`rounded-xl border px-2 py-2.5 text-[10px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${colors}`}>{icon}{label}</button>;
}

function QuoteCard({ label, symbol, quote, kind, loading }: { label: string; symbol: string; quote: MarketBriefing["currency"]; kind: "currency" | "index"; loading: boolean }) {
  const positive = (quote?.changePercent || 0) >= 0;
  return (
    <div className="rounded-2xl bg-[#FAFAFC] border border-black/[0.06] p-3.5">
      <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-[#86868B]">{label}</span><span className="text-[9px] font-mono text-[#AEAEB2]">{symbol}</span></div>
      {loading ? <div className="h-6 w-24 bg-black/[0.06] rounded animate-pulse mt-2" /> : quote ? (
        <><strong className="text-lg sm:text-xl font-mono text-[#1D1D1F] block mt-1">{formatQuote(quote.value, kind)}</strong><span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${positive ? "text-emerald-600" : "text-rose-600"}`}>{positive ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}{positive ? "+" : ""}{quote.changePercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% hoje</span></>
      ) : <span className="text-xs text-[#86868B] block mt-2">Indisponível</span>}
    </div>
  );
}
