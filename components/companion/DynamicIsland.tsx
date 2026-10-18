"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
  getDailyCheckIns,
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
  } = useWallet();

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"compra" | "consultor" | "avisos">("compra");
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [checkIns] = useState(() => getDailyCheckIns());

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

  // Sequência de Check-in (apenas para exibição da tag no pill)
  const { streak } = useMemo(() => {
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

  return (
    <>
      {/* ILHA DINÂMICA FLUTUANTE (Top Apple/Wallet Dynamic Island) */}
      <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-50 w-full flex justify-center px-2.5 sm:px-4 pointer-events-none select-none">
        <div
          ref={islandRef}
          className={`pointer-events-auto transition-all duration-300 ease-out border border-white/20 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.22)] ${
            isExpanded
              ? "w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-[24px] sm:rounded-[28px] bg-[#161618]/98 text-white p-4 sm:p-5"
              : "h-10 px-3.5 sm:px-4 rounded-full bg-[#161618]/92 hover:bg-[#161618] text-white flex items-center justify-between gap-2.5 sm:gap-5 cursor-pointer hover:scale-[1.01] active:scale-[0.99] max-w-[calc(100vw-1.25rem)] sm:max-w-md"
          }`}
          onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
        >
          {/* ========================================================
              MODO COMPACTO (Pílula Elegante e Sem Recortes Visuais)
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
                <span className="text-[11px] sm:text-xs font-bold font-mono text-emerald-400">
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
                MODO EXPANDIDO (HUD de Comando Wallet - Informações Úteis)
               ======================================================== */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Header Expandido com Abas Únicas */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-full text-xs font-medium overflow-x-auto no-scrollbar max-w-full">
                  <button
                    type="button"
                    onClick={() => setActiveTab("compra")}
                    className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer shrink-0 text-[11px] sm:text-xs ${
                      activeTab === "compra"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Melhor Compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("consultor")}
                    className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer shrink-0 text-[11px] sm:text-xs ${
                      activeTab === "consultor"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    Consultor {companionAdvice.agentName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("avisos")}
                    className={`px-2.5 sm:px-3 py-1 rounded-full transition-all cursor-pointer relative shrink-0 text-[11px] sm:text-xs ${
                      activeTab === "avisos"
                        ? "bg-white text-black font-semibold shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    <span>Faturas & Contas</span>
                    {upcomingEvents.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 text-[9px] rounded-full bg-amber-500 text-black font-bold">
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

              {/* ABA 1: MELHOR COMPRA HOJE (INTELIGÊNCIA EXCLUSIVA - ZERO DUPLICAÇÃO) */}
              {activeTab === "compra" && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  {bestCard ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-transparent border border-blue-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                          <CreditCard size={14} />
                          <span>Recomendação de Compra Hoje</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200">
                          Fecha dia {bestCard.closingDay}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-white">
                          Use o {bestCard.cardName}
                        </h3>
                        <p className="text-xs text-[#A1A1A6] leading-relaxed">
                          {bestCard.reason}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
                        <span className="text-[#86868B]">Limite Disponível:</span>
                        <strong className="font-mono text-emerald-400">
                          R$ {formatCurrency(bestCard.availableLimit)}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 text-xs text-[#A1A1A6]">
                      Nenhum cartão com ciclo ativo cadastrado. Cadastre um cartão de crédito para ativar as recomendações inteligentes.
                    </div>
                  )}

                  {/* Ações de 1 Clique */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExpanded(false);
                        setIsQuickCaptureOpen(true);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-white/90 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Plus size={14} />
                      <span>Lançar gasto rápido</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExpanded(false);
                        setIsSimulatorOpen(true);
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 border border-white/10"
                    >
                      <Calculator size={14} />
                      <span>Devo comprar isto?</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ABA 2: CONSULTOR (SÍNTESE ESTRATÉGICA E PERGUNTAS RÁPIDAS) */}
              {activeTab === "consultor" && (
                <div className="space-y-3 animate-in fade-in duration-150">
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

                  {/* Atalhos de Pergunta Estratégica */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] block">
                      Perguntas Rápidas ao Assistente:
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
                </div>
              )}

              {/* ABA 3: AVISOS (FATURAS E VENCIMENTOS PRÓXIMOS) */}
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

                        <strong className="font-mono text-white text-sm">
                          R$ {formatCurrency(event.amount)}
                        </strong>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Rodapé da Ilha */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-[#86868B]">
                <span className="text-white/60">Wallet Intelligence</span>
                <span className="text-[10px] text-white/40">Pressione Esc para fechar</span>
              </div>
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
