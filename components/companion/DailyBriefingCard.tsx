"use client";

import React, { useState, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import {
  calculateDailySafeSpend,
  getUpcomingFinancialEvents,
  getDailyCheckIns,
  saveDailyCheckIn,
  calculateCheckInStreak,
  generateDailyCompanionAdvice,
  calculateWeeklySpendingVelocity,
  getBestCardToSpendToday,
} from "@/lib/services/dailyCompanionService";
import { AgentAvatar } from "./AgentAvatar";
import { QuickCaptureModal } from "./QuickCaptureModal";
import { PurchaseSimulatorModal } from "./PurchaseSimulatorModal";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Calculator,
  Plus,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Flame,
  Activity,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

export function DailyBriefingCard() {
  const {
    userProfile,
    cards,
    recurringItems,
    transactions,
    mainBalance,
    monthExpense,
    getMonthlyProjection,
  } = useWallet();

  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [checkIns, setCheckIns] = useState(() => getDailyCheckIns());
  const [checkInFeedback, setCheckInFeedback] = useState<string | null>(null);

  // Saudação por horário
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const firstName = (userProfile.name || "Investidor").split(" ")[0];

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

  // Velocidade Semanal de Gastos
  const weeklyVelocity = useMemo(() => {
    return calculateWeeklySpendingVelocity({ transactions });
  }, [transactions]);

  // Melhor Cartão para Gastar Hoje
  const bestCard = useMemo(() => {
    return getBestCardToSpendToday({ cards });
  }, [cards]);

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

  const urgentEvent = upcomingEvents.find((e) => e.isUrgent) || upcomingEvents[0];

  // Sequência de Disciplina
  const { streak } = useMemo(() => {
    return calculateCheckInStreak(checkIns);
  }, [checkIns]);

  // Conselho do Companheiro
  const advice = useMemo(() => {
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

  const handleDoCheckIn = (mood: "in_control" | "unexpected_spend" | "tight_savings") => {
    const record = saveDailyCheckIn(mood);
    setCheckIns([record, ...checkIns.filter((c) => c.date !== record.date)]);
    setCheckInFeedback("Check-in registrado! Foco mantido 🎯");
    setTimeout(() => setCheckInFeedback(null), 3000);
  };

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <section className="w-full rounded-[24px] sm:rounded-[32px] bg-white/95 backdrop-blur-2xl border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-4 sm:p-7 relative overflow-hidden transition-all">
        {/* Glow de Fundo Elegante */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-400/10 via-orange-400/5 to-transparent rounded-full blur-3xl pointer-events-none -z-0" />

        <div className="relative z-10 space-y-6">
          {/* TOPO: Saudação + Avatar do Guardião + Streak */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <AgentAvatar
                persona={userProfile.persona || "guardian"}
                state={advice.avatarState}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#86868B] uppercase tracking-wider">
                    {greeting}, {firstName}
                  </span>
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      <Flame size={12} className="text-amber-500 fill-amber-500" />
                      <span>{streak}d de foco consecutivo</span>
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-[#1D1D1F] tracking-tight">
                  Seu Apoio Financeiro de Hoje
                </h1>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsQuickCaptureOpen(true)}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
              >
                <Plus size={14} />
                <span>Lançar gasto</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSimulatorOpen(true)}
                className="flex-1 sm:flex-initial justify-center px-3.5 py-2 rounded-xl bg-white hover:bg-[#F2F2F7] text-[#1D1D1F] text-xs font-semibold border border-black/10 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer min-h-[40px]"
              >
                <Calculator size={14} />
                <span>Devo comprar?</span>
              </button>
            </div>
          </div>

          {/* GRADE DE 4 PILARES DE INTELIGÊNCIA FINANCEIRA DO DIA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. TETO DIÁRIO SEGURO */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
              <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block">
                Teto Seguro Hoje
              </span>
              <strong className="text-xl font-bold font-mono text-emerald-600 block tabular-nums">
                R$ {formatCurrency(safeSpendMetric.safeDailyAllowance)}
              </strong>
              <p className="text-[11px] text-[#86868B]">
                Restam {safeSpendMetric.remainingDaysInMonth} dias no mês
              </p>
            </div>

            {/* 2. RITMO SEMANAL DE CONSUMO (NOVO - VELOCIDADE REAL) */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
              <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block flex items-center gap-1">
                <Activity size={12} className="text-blue-500" />
                <span>Últimos 7 Dias</span>
              </span>
              <strong className="text-xl font-bold font-mono text-[#1D1D1F] block tabular-nums">
                R$ {formatCurrency(weeklyVelocity.last7DaysTotal)}
              </strong>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
                  weeklyVelocity.trend === "reduced"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : weeklyVelocity.trend === "accelerated"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {weeklyVelocity.headline}
              </span>
            </div>

            {/* 3. MELHOR CARTÃO PARA COMPRAR HOJE (NOVO - INTELIGÊNCIA EXCLUSIVA) */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
              <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block flex items-center gap-1">
                <CreditCard size={12} className="text-indigo-500" />
                <span>Melhor Cartão Hoje</span>
              </span>
              {bestCard ? (
                <>
                  <strong className="text-sm font-bold text-[#1D1D1F] truncate block">
                    {bestCard.cardName}
                  </strong>
                  <p className="text-[10px] text-[#86868B] leading-tight">
                    Fecha dia {bestCard.closingDay} • Vence dia {bestCard.dueDay}
                  </p>
                </>
              ) : (
                <>
                  <strong className="text-sm font-semibold text-[#86868B] block">
                    Débito / Pix
                  </strong>
                  <p className="text-[10px] text-[#86868B]">Sem cartões de crédito</p>
                </>
              )}
            </div>

            {/* 4. PRÓXIMO VENCIMENTO */}
            <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1">
              <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider block">
                Próximo Vencimento
              </span>
              {urgentEvent ? (
                <>
                  <strong className="text-sm font-bold text-[#1D1D1F] truncate block">
                    {urgentEvent.title}
                  </strong>
                  <p className="text-[11px] text-[#86868B]">
                    R$ {formatCurrency(urgentEvent.amount)} • {urgentEvent.dueDate} ({urgentEvent.daysRemaining === 0 ? "Hoje" : `em ${urgentEvent.daysRemaining}d`})
                  </p>
                </>
              ) : (
                <>
                  <strong className="text-sm font-semibold text-emerald-600 block">
                    Sem contas urgentes
                  </strong>
                  <p className="text-[11px] text-[#86868B]">Tudo em dia nesta semana</p>
                </>
              )}
            </div>
          </div>

          {/* BALÃO DE PENSAMENTO & CONSELHO PROATIVO DO ASSISTENTE */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.07] via-orange-500/[0.05] to-transparent border border-amber-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-amber-800">
                  {advice.agentName} diz:
                </span>
                <span className="text-[11px] font-semibold text-[#1D1D1F]">
                  "{advice.headline}"
                </span>
              </div>
              <p className="text-xs text-[#636366] leading-relaxed">
                {advice.advice}
              </p>
            </div>

            <Link
              href="/ai"
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-black transition-colors shrink-0"
            >
              <span>Conversar com {advice.agentName}</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* CHECK-IN DIÁRIO EXCLUSIVO (1 CLIQUE) */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-black/[0.04]">
            <span className="text-xs font-medium text-[#86868B]">
              Como você avalia seus gastos hoje?
            </span>

            {checkInFeedback ? (
              <span className="text-xs font-bold text-emerald-600 animate-in zoom-in flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>{checkInFeedback}</span>
              </span>
            ) : (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleDoCheckIn("in_control")}
                  className="flex-1 sm:flex-initial justify-center text-center px-3 py-2 rounded-full bg-[#F2F2F7] hover:bg-emerald-50 text-[#1D1D1F] hover:text-emerald-800 text-[11px] sm:text-xs font-medium border border-transparent hover:border-emerald-200 transition-all cursor-pointer min-h-[36px]"
                >
                  🟢 100% No Controle
                </button>
                <button
                  type="button"
                  onClick={() => handleDoCheckIn("unexpected_spend")}
                  className="flex-1 sm:flex-initial justify-center text-center px-3 py-2 rounded-full bg-[#F2F2F7] hover:bg-amber-50 text-[#1D1D1F] hover:text-amber-800 text-[11px] sm:text-xs font-medium border border-transparent hover:border-amber-200 transition-all cursor-pointer min-h-[36px]"
                >
                  🟡 Gastos Imprevistos
                </button>
                <button
                  type="button"
                  onClick={() => handleDoCheckIn("tight_savings")}
                  className="flex-1 sm:flex-initial justify-center text-center px-3 py-2 rounded-full bg-[#F2F2F7] hover:bg-blue-50 text-[#1D1D1F] hover:text-blue-800 text-[11px] sm:text-xs font-medium border border-transparent hover:border-blue-200 transition-all cursor-pointer min-h-[36px]"
                >
                  🛡️ Modo Economia
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

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
