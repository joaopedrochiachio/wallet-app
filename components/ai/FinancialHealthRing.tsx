"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Wallet,
  Calculator,
  Target,
  Edit3,
  Check,
  X,
  ArrowUpRight,
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
  const [activePillar, setActivePillar] = useState<"overall" | "target" | "balance" | "invoices">("overall");
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [tempTarget, setTempTarget] = useState(String(targetEndMonthBalance));

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Saldo projetado efetivo (se não fornecido, usa mainBalance - pendingBills ou mainBalance)
  const effectiveProjected =
    projectedFreeBalance !== undefined
      ? projectedFreeBalance
      : mainBalance - pendingBills;

  const isTargetMet = effectiveProjected >= targetEndMonthBalance;
  const effectiveMargin = Math.max(0, effectiveProjected - targetEndMonthBalance);
  const effectiveMissing = Math.max(0, targetEndMonthBalance - effectiveProjected);

  // Progresso em direção à meta (0 a 100%)
  const targetProgress =
    targetEndMonthBalance > 0
      ? Math.min(100, Math.max(5, Math.round((effectiveProjected / targetEndMonthBalance) * 100)))
      : 100;

  // Níveis de saúde Apple
  const getBadge = () => {
    if (score >= 80) {
      return {
        label: isTargetMet ? "Meta no Caminho Certo" : "Saudável",
        color: "text-emerald-700",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        ringColor: "#34C759",
      };
    }
    if (score >= 65) {
      return {
        label: isTargetMet ? "Meta Alcançada" : "Equilibrado",
        color: "text-blue-700",
        bg: "bg-blue-500/10 border-blue-500/20",
        ringColor: "#007AFF",
      };
    }
    if (score >= 45) {
      return {
        label: "Atenção na Meta",
        color: "text-amber-700",
        bg: "bg-amber-500/10 border-amber-500/20",
        ringColor: "#FF9500",
      };
    }
    return {
      label: "Meta em Risco",
      color: "text-rose-700",
      bg: "bg-rose-500/10 border-rose-200/60",
      ringColor: "#FF3B30",
    };
  };

  const badge = getBadge();

  // Dimensões dos 3 Anéis Apple Health
  // Anel 1 (Externo): Score Geral (raio 46, circunf ~289)
  // Anel 2 (Médio): Progresso da Meta do Mês (raio 36, circunf ~226)
  // Anel 3 (Interno): Liquidez vs Pendências Imediatas (raio 26, circunf ~163)
  const ring1Pct = Math.min(100, Math.max(5, score));
  const ring2Pct = targetProgress;
  const liquidityRatio = pendingBills > 0 ? (mainBalance / pendingBills) * 100 : 100;
  const ring3Pct = Math.min(100, Math.max(5, liquidityRatio));

  const c1 = 2 * Math.PI * 46;
  const c2 = 2 * Math.PI * 36;
  const c3 = 2 * Math.PI * 26;

  const handleSaveTarget = () => {
    const parsed = parseFloat(tempTarget.replace(/\./g, "").replace(",", "."));
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateTarget?.(parsed);
    }
    setIsEditingTarget(false);
  };

  return (
    <section className="bg-white/90 backdrop-blur-xl rounded-[28px] p-5 sm:p-7 border border-black/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6 relative overflow-hidden">
      {/* Siri Ambient Subtle Edge Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-purple-400/10 via-pink-400/10 to-blue-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header do Diagnóstico com Anéis Apple Fitness e Métricas Chave */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Bloco dos Anéis e Título */}
        <div className="flex items-center gap-5 sm:gap-6">
          {/* Anéis de Atividade Tríplices Apple Health */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
              {/* Trilhas de Fundo */}
              <circle cx="55" cy="55" r="46" stroke="#000000" strokeOpacity="0.04" strokeWidth="6.5" fill="none" />
              <circle cx="55" cy="55" r="36" stroke="#000000" strokeOpacity="0.04" strokeWidth="6.5" fill="none" />
              <circle cx="55" cy="55" r="26" stroke="#000000" strokeOpacity="0.04" strokeWidth="6.5" fill="none" />

              {/* Anel 1 (Externo): Score Geral */}
              <circle
                cx="55"
                cy="55"
                r="46"
                stroke={badge.ringColor}
                strokeWidth="6.5"
                strokeDasharray={c1}
                strokeDashoffset={c1 - (c1 * ring1Pct) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />

              {/* Anel 2 (Médio): Progresso da Meta do Mês (Esmeralda se atingida, Âmbar se em risco) */}
              <circle
                cx="55"
                cy="55"
                r="36"
                stroke={isTargetMet ? "#34C759" : "#FF9500"}
                strokeWidth="6.5"
                strokeDasharray={c2}
                strokeDashoffset={c2 - (c2 * ring2Pct) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />

              {/* Anel 3 (Interno): Cobertura de Liquidez (Azul Apple) */}
              <circle
                cx="55"
                cy="55"
                r="26"
                stroke="#007AFF"
                strokeWidth="6.5"
                strokeDasharray={c3}
                strokeDashoffset={c3 - (c3 * ring3Pct) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Pontuação no Centro */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F] font-mono leading-none">
                {score}
              </span>
              <span className="text-[9px] font-semibold text-[#86868B] uppercase tracking-wider mt-0.5">
                Pontos
              </span>
            </div>
          </div>

          {/* Textos de Status e Descrição */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] tracking-tight">
                Saúde Financeira & Meta
              </h2>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            <p className="text-xs text-[#86868B] leading-relaxed max-w-sm">
              Auditoria em tempo real com rigor contábil: foco no saldo líquido final de R$ {formatCurrency(targetEndMonthBalance)}.
            </p>

            {/* Legenda dos Anéis */}
            <div className="flex items-center gap-3 pt-1 text-[10px] text-[#86868B] flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: badge.ringColor }} />
                <span>Score ({score})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isTargetMet ? "bg-[#34C759]" : "bg-[#FF9500]"}`} />
                <span>Meta ({targetProgress}%)</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                <span>Liquidez em Conta</span>
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Ação Rápida */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={onOpenSimulator}
            className="bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold px-4.5 py-2.5 rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Calculator size={14} />
            <span>Simulador de Compra</span>
          </button>
        </div>
      </div>

      {/* 2. Grid dos 3 Pilares com FOCO NA META FINAL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 relative z-10">
        {/* Pilar 1: META DO MÊS (Substitui o teto arbitrário de 35%) */}
        <div
          className={`p-4 rounded-2xl border text-left transition-all relative ${
            activePillar === "target"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
              <Target size={11} className={isTargetMet ? "text-emerald-600" : "text-amber-600"} />
              Meta do Mês
            </span>
            {isEditingTarget ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSaveTarget}
                  className="p-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  title="Salvar nova meta"
                >
                  <Check size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTarget(false)}
                  className="p-1 rounded-full bg-black/10 text-[#1D1D1F] hover:bg-black/20 cursor-pointer"
                  title="Cancelar"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTempTarget(String(targetEndMonthBalance));
                  setIsEditingTarget(true);
                }}
                className="text-[10px] text-[#007AFF] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                title="Ajustar saldo alvo do mês"
              >
                <span>Alvo: R$ {formatCurrency(targetEndMonthBalance)}</span>
                <Edit3 size={10} />
              </button>
            )}
          </div>

          {isEditingTarget ? (
            <div className="my-1.5">
              <label className="text-[10px] text-[#86868B] block mb-0.5">Novo Saldo Alvo:</label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono font-semibold text-[#1D1D1F]">R$</span>
                <input
                  type="number"
                  value={tempTarget}
                  onChange={(e) => setTempTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTarget();
                    if (e.key === "Escape") setIsEditingTarget(false);
                  }}
                  autoFocus
                  className="w-full text-base font-bold font-mono px-2 py-0.5 rounded-lg border border-black/20 bg-white focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5 my-1">
              <strong
                className={`text-xl font-bold font-mono tabular-nums ${
                  effectiveProjected >= targetEndMonthBalance ? "text-emerald-600" : "text-[#1D1D1F]"
                }`}
              >
                R$ {formatCurrency(effectiveProjected)}
              </strong>
              <span
                className={`text-[11px] font-medium ${
                  isTargetMet ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {isTargetMet
                  ? `+R$ ${formatCurrency(effectiveMargin)} livre`
                  : `-R$ ${formatCurrency(effectiveMissing)} da meta`}
              </span>
            </div>
          )}

          {/* Micro medidor de progresso da meta */}
          <div className="h-1.5 w-full bg-black/[0.04] rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isTargetMet ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, targetProgress)}%` }}
            />
          </div>
          <div className="text-[10px] text-[#86868B] flex items-center justify-between mt-1.5 pt-1 border-t border-black/[0.03]">
            <span>Saldo projetado no final do mês</span>
            <span className="font-mono font-medium text-[#1D1D1F]">{targetProgress}% atingido</span>
          </div>
        </div>

        {/* Pilar 2: Saldo em Conta */}
        <button
          type="button"
          onClick={() => setActivePillar(activePillar === "balance" ? "overall" : "balance")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePillar === "balance"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
              <Wallet size={11} className="text-emerald-600" />
              Saldo em Conta
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Disponível Hoje</span>
          </div>

          <div className="my-1">
            <strong className="text-xl font-bold text-emerald-600 font-mono tabular-nums truncate block">
              R$ {formatCurrency(mainBalance)}
            </strong>
          </div>

          {/* Micro indicador de liquidez */}
          <div className="text-[11px] text-[#86868B] flex items-center justify-between mt-2 pt-1 border-t border-black/[0.03]">
            <span>Pendências do mês:</span>
            <span className="font-mono font-medium text-[#1D1D1F]">R$ {formatCurrency(pendingBills)}</span>
          </div>
        </button>

        {/* Pilar 3: Faturas e Gastos Fixos Comprometidos */}
        <button
          type="button"
          onClick={() => setActivePillar(activePillar === "invoices" ? "overall" : "invoices")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePillar === "invoices"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.04]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider flex items-center gap-1">
              <CreditCard size={11} className="text-indigo-600" />
              Faturas em Aberto
            </span>
            <span className="text-[10px] text-[#86868B]">Cartões</span>
          </div>

          <div className="my-1">
            <strong className="text-xl font-bold text-[#1D1D1F] font-mono tabular-nums truncate block">
              R$ {formatCurrency(totalInvoices)}
            </strong>
          </div>

          {/* Micro indicador de impacto */}
          <div className="text-[11px] text-[#86868B] flex items-center justify-between mt-2 pt-1 border-t border-black/[0.03]">
            <span>Vencimento próximo:</span>
            <span className="font-semibold text-rose-600 font-mono">Consome caixa</span>
          </div>
        </button>
      </div>

      {/* 3. Veredito Executivo do CFO Pessoal (Card Apple Siri Glass) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F9F9FB] via-white to-[#F2F2F7]/70 border border-black/[0.06] shadow-2xs space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
              <Sparkles size={12} className="text-purple-300" />
            </div>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              Veredito do Analista Financeiro
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              onDiscussWithAI(
                `Analise com rigor matemático se vou conseguir fechar o mês com R$ ${formatCurrency(
                  targetEndMonthBalance
                )} positivo e quais são os principais vilões do meu orçamento recente.`
              )
            }
            className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Conversar com a Siri</span>
            <ArrowUpRight size={12} />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#1D1D1F] leading-relaxed font-normal">
          {executiveSummary ||
            `Panorama do mês: seu saldo projetado para fechar o mês está em R$ ${formatCurrency(
              effectiveProjected
            )}, ${
              isTargetMet
                ? `cumprindo a meta de fechar com R$ ${formatCurrency(
                    targetEndMonthBalance
                  )} positivo — com margem segura de R$ ${formatCurrency(effectiveMargin)} para despesas extras.`
                : `restando R$ ${formatCurrency(
                    effectiveMissing
                  )} para atingir a meta estipulada de fechar com R$ ${formatCurrency(targetEndMonthBalance)} positivo.`
            }`}
        </p>

        {/* 3 Insights Táticos Rápidos da IA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-black/[0.04] text-[11px]">
          <button
            type="button"
            onClick={() =>
              onDiscussWithAI(
                `Como posso garantir que vou fechar o mês com R$ ${formatCurrency(
                  targetEndMonthBalance
                )} de saldo positivo?`
              )
            }
            className="flex items-center gap-1.5 text-emerald-800 bg-emerald-500/10 hover:bg-emerald-500/15 px-2.5 py-1.5 rounded-xl border border-emerald-500/15 text-left cursor-pointer transition-all"
          >
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            <span className="truncate">
              {isTargetMet
                ? `Margem livre de R$ ${formatCurrency(effectiveMargin)}`
                : `Faltam R$ ${formatCurrency(effectiveMissing)} para a meta`}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              onDiscussWithAI(
                `Quais foram os maiores vilões do meu orçamento recente e como posso reduzir despesas?`
              )
            }
            className="flex items-center gap-1.5 text-blue-800 bg-blue-500/10 hover:bg-blue-500/15 px-2.5 py-1.5 rounded-xl border border-blue-500/15 text-left cursor-pointer transition-all"
          >
            <TrendingUp size={12} className="text-blue-600 shrink-0" />
            <span className="truncate">Auditar maiores vilões e gastos</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onDiscussWithAI(
                `Quanto dinheiro ainda posso gastar com segurança até o final deste mês sem comprometer a meta?`
              )
            }
            className="flex items-center gap-1.5 text-amber-800 bg-amber-500/10 hover:bg-amber-500/15 px-2.5 py-1.5 rounded-xl border border-amber-500/15 text-left cursor-pointer transition-all"
          >
            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
            <span className="truncate">Calcular teto seguro diário</span>
          </button>
        </div>
      </div>
    </section>
  );
}
