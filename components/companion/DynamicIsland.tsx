"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
  getDailyCheckIns,
  saveDailyCheckIn,
  calculateCheckInStreak,
  generateDailyCompanionAdvice,
  getBestCardToSpendToday,
} from "@/lib/services/dailyCompanionService";
import { AgentAvatar } from "./AgentAvatar";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Plus,
  CreditCard,
  Calculator,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building2,
  ArrowDownLeft,
} from "lucide-react";
import Link from "next/link";

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
  const [activeTab, setActiveTab] = useState<"hoje" | "consultor" | "avisos">("hoje");
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState(() => getDailyCheckIns());
  const [activeMoodSelected, setActiveMoodSelected] = useState<string | null>(null);

  const islandRef = useRef<HTMLDivElement>(null);

  // Projeção e Margem Diária
  const currentMonthProj = getMonthlyProjection(0);
  const effectiveProjectedFree =
    currentMonthProj?.projectedFreeBalance ?? (mainBalance - monthExpense);
  const targetEndMonthBalance = userProfile?.targetMonthEndBalance || 700;

  const safeSpendMetric = useMemo(() => {
    return calculateDailySafeSpend({
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
    });
  }, [effectiveProjectedFree, targetEndMonthBalance]);

  // Próximos Vencimentos (Apenas contas pendentes e futuras de hoje em diante)
  const upcomingEvents = useMemo(() => {
    return getUpcomingFinancialEvents({
      cards,
      recurringItems,
      transactions,
      cardInvoiceProjections: currentMonthProj?.cardInvoices,
      onlyExpenses: true,
    });
  }, [cards, recurringItems, transactions, currentMonthProj?.cardInvoices]);

  const urgentEvents = upcomingEvents.filter((e) => e.isUrgent);

  // Sequência de Check-in
  const { streak, todayCheckedIn } = useMemo(() => {
    return calculateCheckInStreak(checkIns);
  }, [checkIns]);

  // Inteligência do Melhor Cartão Hoje
  const bestCard = useMemo(() => {
    return getBestCardToSpendToday({ cards });
  }, [cards]);

  // Conselho e Personalidade do Agente
  const companionAdvice = useMemo(() => {
    return generateDailyCompanionAdvice({
      userName: userProfile.name,
      projectedFreeBalance: effectiveProjectedFree,
      targetEndMonthBalance,
      safeDailyAllowance: safeSpendMetric.safeDailyAllowance,
      upcomingEventsCount: upcomingEvents.length,
      streakCount: streak,
      persona: userProfile.persona || "guardian",
    });
  }, [
    userProfile.name,
    userProfile.persona,
    effectiveProjectedFree,
    targetEndMonthBalance,
    safeSpendMetric.safeDailyAllowance,
    upcomingEvents.length,
    streak,
  ]);

  // Checar humor registrado hoje
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const rec = checkIns.find((c) => c.date === today);
    if (rec) {
      setActiveMoodSelected(rec.mood);
    }
  }, [checkIns]);

  const handlePerformCheckIn = (mood: "in_control" | "unexpected_spend" | "tight_savings") => {
    const saved = saveDailyCheckIn(mood);
    setCheckIns(getDailyCheckIns());
    setActiveMoodSelected(saved.mood);
  };

  // Fechar ao clicar fora ou pressionar Esc
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handlePayRecurringFromIsland = async (recurringItemId: string) => {
    const item = recurringItems.find((r) => r.id === recurringItemId);
    if (!item) return;
    setPayingId(`recurring_${recurringItemId}`);
    try {
      const now = new Date();
      await realizeRecurringItemNow(item, now.getFullYear(), now.getMonth());
    } catch (err) {
      console.error("Erro ao dar baixa via Dynamic Island:", err);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <>
      {/* ILHA DINÂMICA FLUTUANTE (Top Apple/Wallet Dynamic Island) */}
      <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 w-full flex justify-center px-2.5 sm:px-4 pointer-events-none select-none">
        <div
          ref={islandRef}
          className={`pointer-events-auto transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border border-white/[0.14] ring-1 ring-black/40 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${
            isExpanded
              ? "w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-[28px] sm:rounded-[32px] bg-[#161618]/98 text-white p-4 sm:p-5"
              : "h-10 px-3.5 sm:px-4 rounded-full bg-[#161618]/94 hover:bg-[#161618] text-white flex items-center justify-between gap-2.5 sm:gap-4 cursor-pointer hover:scale-[1.01] active:scale-[0.99] max-w-[calc(100vw-1.25rem)] sm:max-w-md"
          }`}
          onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
        >
          {/* ========================================================
              MODO COMPACTO (Pílula Elegante Estilo iPhone 16 Pro)
             ======================================================== */}
          {!isExpanded ? (
            <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
              {/* Avatar do Guardião */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <AgentAvatar
                  persona={userProfile.persona || "guardian"}
                  state={companionAdvice.avatarState}
                  size="sm"
                  showBadge={false}
                />
                <span className="text-xs font-semibold tracking-tight text-white/90 hidden sm:inline">
                  {companionAdvice.agentName}
                </span>
              </div>

              {/* Teto Diário Seguro */}
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="text-[10px] sm:text-[11px] text-[#A1A1A6] font-medium">Hoje:</span>
                <span className="text-[11px] sm:text-xs font-bold font-mono text-[#00E676] drop-shadow-[0_0_6px_rgba(0,230,118,0.4)]">
                  R$ {formatCurrency(safeSpendMetric.safeDailyAllowance)}
                </span>
                <span className="text-[10px] text-[#86868B] hidden sm:inline">/dia</span>
              </div>

              {/* Tag de Alerta ou Melhor Cartão */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {urgentEvents.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 animate-pulse">
                    <AlertTriangle size={10} />
                    <span>{urgentEvents.length} a vencer</span>
                  </span>
                ) : bestCard ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80 hidden sm:inline-flex">
                    <CreditCard size={10} className="text-blue-300" />
                    <span>{bestCard.cardName}</span>
                  </span>
                ) : streak > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                    <span>🔥 {streak}d</span>
                  </span>
                ) : null}

                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                  <ChevronDown size={12} />
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
                MODO EXPANDIDO (Identidade Fiel ao Screenshot Apple)
               ======================================================== */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Expandido com Abas Estilo Apple */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-full text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
                  <button
                    type="button"
                    onClick={() => setActiveTab("hoje")}
                    className={`px-3.5 py-1 rounded-full transition-all cursor-pointer shrink-0 text-xs ${
                      activeTab === "hoje"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("consultor")}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer shrink-0 text-xs ${
                      activeTab === "consultor"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {companionAdvice.agentName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("avisos")}
                    className={`px-3 py-1 rounded-full transition-all cursor-pointer relative shrink-0 text-xs flex items-center gap-1.5 ${
                      activeTab === "avisos"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    <span>Avisos</span>
                    {upcomingEvents.length > 0 && (
                      <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-black font-bold">
                        {upcomingEvents.length}
                      </span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Recolher ilha"
                >
                  <ChevronUp size={14} />
                </button>
              </div>

              {/* ABA 1: HOJE (EXATAMENTE COMO NO SCREENSHOT DO USUÁRIO) */}
              {activeTab === "hoje" && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {/* Cartão de Gasto Seguro */}
                  <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#A1A1A6] block">
                        GASTO SEGURO DE HOJE
                      </span>
                      <div className="text-2xl sm:text-3xl font-bold font-mono text-[#00E676] drop-shadow-[0_0_8px_rgba(0,230,118,0.35)] tabular-nums">
                        R$ {formatCurrency(safeSpendMetric.safeDailyAllowance)}
                      </div>
                      <p className="text-[11px] text-[#A1A1A6]">
                        Restam {safeSpendMetric.remainingDaysInMonth} dias até o fechamento. Meta: R$ {formatCurrency(targetEndMonthBalance)}.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExpanded(false);
                        setIsSimulatorOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-all cursor-pointer self-start sm:self-center shrink-0"
                    >
                      <Calculator size={14} />
                      <span>Simular compra</span>
                    </button>
                  </div>

                  {/* Card de Check-in do Dia */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                    <span className="text-xs font-medium text-white/90 block">
                      Check-in do dia: Como está seu foco hoje?
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePerformCheckIn("in_control")}
                        className={`py-2 px-2 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                          activeMoodSelected === "in_control"
                            ? "bg-emerald-500/25 border border-emerald-400 text-emerald-200 shadow-sm"
                            : "bg-white/[0.05] hover:bg-white/10 text-white/80 border border-white/5"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>No controle</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePerformCheckIn("unexpected_spend")}
                        className={`py-2 px-2 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                          activeMoodSelected === "unexpected_spend"
                            ? "bg-amber-500/25 border border-amber-400 text-amber-200 shadow-sm"
                            : "bg-white/[0.05] hover:bg-white/10 text-white/80 border border-white/5"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Gastos extras</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePerformCheckIn("tight_savings")}
                        className={`py-2 px-2 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 ${
                          activeMoodSelected === "tight_savings"
                            ? "bg-blue-500/25 border border-blue-400 text-blue-200 shadow-sm"
                            : "bg-white/[0.05] hover:bg-white/10 text-white/80 border border-white/5"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>Poupando</span>
                      </button>
                    </div>
                  </div>

                  {/* Links de Rodapé da Aba Hoje */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-[#A1A1A6] gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExpanded(false);
                          setIsQuickCaptureOpen(true);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Zap size={12} />
                        <span>Captura Rápida</span>
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsExpanded(false);
                          setIsSimulatorOpen(true);
                        }}
                        className="text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Sparkles size={12} />
                        <span>Devo Comprar?</span>
                      </button>
                    </div>

                    <span className="text-[10px] text-white/40">Pressione Esc para fechar</span>
                  </div>
                </div>
              )}

              {/* ABA 2: CONSULTOR (SÍNTESE DO AGENTE E LINK DIRETO PARA O CHAT) */}
              {activeTab === "consultor" && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 flex items-start gap-3.5">
                    <AgentAvatar
                      persona={userProfile.persona || "guardian"}
                      state={companionAdvice.avatarState}
                      size="lg"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          {companionAdvice.agentName} • {companionAdvice.agentTitle}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        {companionAdvice.headline}
                      </h4>
                      <p className="text-xs text-[#A1A1A6] leading-relaxed">
                        {companionAdvice.advice}
                      </p>
                    </div>
                  </div>

                  {/* Atalhos com Link Direto para o Wallet+ Chat */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] block">
                      Perguntas Rápidas ao Auditor:
                    </span>
                    <div className="grid grid-cols-1 gap-1.5">
                      <Link
                        href="/ai"
                        onClick={() => setIsExpanded(false)}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/90 flex items-center justify-between transition-colors cursor-pointer border border-white/5"
                      >
                        <span>💡 Onde posso cortar gastos nesta semana?</span>
                        <ArrowRight size={12} className="text-[#86868B]" />
                      </Link>
                      <Link
                        href="/ai"
                        onClick={() => setIsExpanded(false)}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/90 flex items-center justify-between transition-colors cursor-pointer border border-white/5"
                      >
                        <span>📊 Como fechar na meta de R$ {formatCurrency(targetEndMonthBalance)} positivo?</span>
                        <ArrowRight size={12} className="text-[#86868B]" />
                      </Link>
                    </div>
                  </div>

                  {/* Rodapé da Aba Consultor */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#86868B]">
                    <span className="text-white/60">Wallet Intelligence</span>
                    <span className="text-[10px] text-white/40">Pressione Esc para fechar</span>
                  </div>
                </div>
              )}

              {/* ABA 3: AVISOS (FATURAS E VENCIMENTOS PRÓXIMOS COM BAIXA DIRETA) */}
              {activeTab === "avisos" && (
                <div className="space-y-2.5 animate-in fade-in duration-150 max-h-56 overflow-y-auto pr-1">
                  {upcomingEvents.length === 0 ? (
                    <div className="py-6 text-center text-xs text-[#86868B] space-y-1">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                      <p>Nenhuma fatura ou conta vencendo nos próximos 7 dias.</p>
                    </div>
                  ) : (
                    upcomingEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          event.isUrgent
                            ? "bg-amber-500/15 border-amber-400/30 text-amber-200"
                            : "bg-white/[0.04] border-white/10 text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {event.type === "credit_invoice" ? (
                            <CreditCard size={15} className="shrink-0 text-indigo-400" />
                          ) : event.type === "planned_income" ? (
                            <ArrowDownLeft size={15} className="shrink-0 text-emerald-400" />
                          ) : (
                            <Building2 size={15} className="shrink-0 text-[#A1A1A6]" />
                          )}
                          <div>
                            <strong className="block text-white font-medium">
                              {event.title}
                            </strong>
                            <span className="text-[10px] text-[#A1A1A6]">
                              {event.dueDate} ({event.daysRemaining === 0 ? "Vence hoje" : event.daysRemaining === 1 ? "Amanhã" : `Em ${event.daysRemaining} dias`})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <strong className="font-mono text-white text-sm">
                            R$ {formatCurrency(event.amount)}
                          </strong>

                          {event.id.startsWith("recurring_") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePayRecurringFromIsland(event.id.replace("recurring_", ""));
                              }}
                              disabled={payingId === event.id}
                              className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            >
                              <CheckCircle2 size={11} />
                              <span>{payingId === event.id ? "Baixando..." : "Baixar"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Rodapé da Aba Avisos */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#86868B]">
                    <span className="text-white/60">Wallet Intelligence</span>
                    <span className="text-[10px] text-white/40">Pressione Esc para fechar</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais Globais */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
      />
      <PurchaseSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />
    </>
  );
}

