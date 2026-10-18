"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Calculator,
  Target,
  Edit3,
  Check,
  X,
  ArrowUpRight,
  Zap,
  Flame,
} from "lucide-react";

interface FinancialHealthRingProps {
  score: number;
  healthStatus?: string;
  commitmentRatio?: number;
  commitmentCeiling?: number;
  mainBalance: number;
  totalInvoices: number;
  pendingBills: number;
  targetEndMonthBalance?: number;
  projectedFreeBalance?: number;
  safeSpendingMargin?: number;
  missingAmount?: number;
  targetStatus?: "on_track" | "at_risk";
  onUpdateTarget?: (newTarget: number) => void;
  executiveSummary?: string;
  onOpenSimulator: () => void;
  onDiscussWithAI: (topic: string) => void;
}

export function FinancialHealthRing({
  score,
  healthStatus,
  commitmentRatio = 0,
  commitmentCeiling = 60,
  mainBalance,
  totalInvoices,
  pendingBills,
  targetEndMonthBalance = 700,
  projectedFreeBalance,
  safeSpendingMargin = 0,
  missingAmount = 0,
  targetStatus = "on_track",
  onUpdateTarget,
  executiveSummary,
  onOpenSimulator,
  onDiscussWithAI,
}: FinancialHealthRingProps) {
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(String(targetEndMonthBalance));

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const effectiveProjected =
    projectedFreeBalance !== undefined ? projectedFreeBalance : mainBalance - pendingBills;

  const isTargetMet = effectiveProjected >= targetEndMonthBalance;
  const effectiveMargin = Math.max(0, effectiveProjected - targetEndMonthBalance);
  const effectiveMissing = Math.max(0, targetEndMonthBalance - effectiveProjected);

  // Progresso em direção à meta (0 a 100%)
  const targetProgress =
    targetEndMonthBalance > 0
      ? Math.min(100, Math.max(5, Math.round((effectiveProjected / targetEndMonthBalance) * 100)))
      : 100;

  const handleSaveTarget = () => {
    const parsed = parseFloat(tempTarget.replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateTarget?.(parsed);
    }
    setIsEditingTarget(false);
  };

  // Cores dinâmicas Apple baseadas na pontuação
  const isHealthy = score >= 75;
  const primaryGlow = isHealthy ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)";
  const strokeColor = isHealthy ? "#10B981" : "#F59E0B";

  // Circunferência do anel holográfico (raio 42, circunf ~264)
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(100, Math.max(5, score))) / 100;

  return (
    <section className="bg-white/95 backdrop-blur-2xl rounded-[32px] p-5 sm:p-7 border border-black/[0.06] shadow-[0_12px_40px_rgba(0,0,0,0.03)] space-y-6 relative overflow-hidden transition-all">
      {/* Glow de Borda Apple Ambient */}
      <div
        className="absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none -z-0"
        style={{ background: primaryGlow }}
      />

      {/* 1. TELEMETRIA PRINCIPAL: DIAL HOLOGRÁFICO + STATUS EXECUTIVO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
        <div className="flex items-center gap-4 sm:gap-5 min-w-0">
          {/* Anel de Precisão Apple Vision */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90 select-none" viewBox="0 0 100 100">
              {/* Trilha de Fundo Suave */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="#000000"
                strokeOpacity="0.05"
                strokeWidth="7"
                fill="none"
              />
              {/* Anel Ativo com Gradiente */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={strokeColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Pontuação Central com Tipografia SF Pro */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1D1D1F] font-mono leading-none">
                {score}
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-[#86868B] uppercase tracking-widest mt-0.5">
                Pontos
              </span>
            </div>
          </div>

          {/* Textos de Status e Explicação Clara */}
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[#1D1D1F] tracking-tight">
                Saúde Financeira & Meta
              </h2>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isTargetMet
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {isTargetMet ? "Meta no Caminho Certo" : "Atenção no Fechamento"}
              </span>
            </div>

            <p className="text-xs text-[#86868B] leading-relaxed">
              Auditoria em tempo real com rigor contábil: foco no saldo de R$ {formatCurrency(targetEndMonthBalance)}.
            </p>

            <div className="flex items-center gap-2 pt-0.5 text-[10px] text-[#86868B] flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Score ({score})</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-blue-700">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Meta ({targetProgress}%)</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-indigo-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>Liquidez em Conta</span>
              </span>
            </div>
          </div>
        </div>

        {/* Botão Simulador de Compra Apple Style */}
        <button
          type="button"
          onClick={onOpenSimulator}
          className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4.5 py-2.5 rounded-full transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Calculator size={14} />
          <span>Simulador de Compra</span>
        </button>
      </div>

      {/* 2. OS 3 CARDS HOLOGRÁFICOS DE INDICADORES VITAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 relative z-10">
        {/* Card 1: META DO MÊS */}
        <div className="p-4 rounded-2xl bg-[#FAFAFC] hover:bg-white border border-black/[0.04] hover:border-black/10 transition-all shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#86868B]">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-[#1D1D1F]">
              <Target size={12} className={isTargetMet ? "text-emerald-600" : "text-amber-600"} />
              Meta do Mês
            </span>

            {isEditingTarget ? (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-black/10 rounded"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveTarget}
                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  className="p-1 rounded bg-black/10 text-black hover:bg-black/20"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTarget(String(targetEndMonthBalance));
                  setIsEditingTarget(true);
                }}
                className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                title="Editar valor alvo da meta"
              >
                <span>Alvo: R$ {formatCurrency(targetEndMonthBalance)}</span>
                <Edit3 size={10} />
              </button>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <strong className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
              R$ {formatCurrency(effectiveProjected)}
            </strong>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
              +{formatCurrency(effectiveMargin)} livre
            </span>
          </div>

          {/* Barra de Progresso da Meta */}
          <div className="w-full bg-[#E5E5EA] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isTargetMet ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${targetProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[#86868B]">
            <span>Saldo projetado final</span>
            <span className="font-bold text-[#1D1D1F]">{targetProgress}% atingido</span>
          </div>
        </div>

        {/* Card 2: SALDO EM CONTA */}
        <div className="p-4 rounded-2xl bg-[#FAFAFC] hover:bg-white border border-black/[0.04] hover:border-black/10 transition-all shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#86868B]">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-[#1D1D1F]">
              <TrendingUp size={12} className="text-blue-600" />
              Saldo em Conta
            </span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
              Disponível Hoje
            </span>
          </div>

          <strong className="text-xl font-bold font-mono text-[#1D1D1F] block tabular-nums">
            R$ {formatCurrency(mainBalance)}
          </strong>

          <div className="pt-1 border-t border-black/[0.04] flex items-center justify-between text-[10px] text-[#86868B]">
            <span>Pendências do mês:</span>
            <span className="font-mono font-bold text-[#1D1D1F]">
              R$ {formatCurrency(pendingBills)}
            </span>
          </div>
        </div>

        {/* Card 3: FATURAS EM ABERTO */}
        <div className="p-4 rounded-2xl bg-[#FAFAFC] hover:bg-white border border-black/[0.04] hover:border-black/10 transition-all shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-[#86868B]">
            <span className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-[#1D1D1F]">
              <CreditCard size={12} className="text-indigo-600" />
              Faturas em Aberto
            </span>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
              Cartões
            </span>
          </div>

          <strong className="text-xl font-bold font-mono text-[#1D1D1F] block tabular-nums">
            R$ {formatCurrency(totalInvoices)}
          </strong>

          <div className="pt-1 border-t border-black/[0.04] flex items-center justify-between text-[10px] text-[#86868B]">
            <span>Vencimento próximo:</span>
            <span className="font-semibold text-amber-700">Consome caixa futuro</span>
          </div>
        </div>
      </div>
    </section>
  );
}
