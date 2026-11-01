"use client";

import React, { useState } from "react";
import { Calculator, Check, CreditCard, Edit3, MessageCircle, Target, TrendingUp, X } from "lucide-react";

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ringOffset(radius: number, progress: number) {
  const circumference = 2 * Math.PI * radius;
  return { circumference, offset: circumference - (circumference * Math.min(100, Math.max(0, progress))) / 100 };
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
  const effectiveProjected = projectedFreeBalance ?? mainBalance - pendingBills;
  const targetProgress = targetEndMonthBalance > 0 ? Math.min(100, Math.max(0, (effectiveProjected / targetEndMonthBalance) * 100)) : 100;
  const isTargetMet = targetStatus === "on_track" || effectiveProjected >= targetEndMonthBalance;
  const margin = isTargetMet ? Math.max(safeSpendingMargin, effectiveProjected - targetEndMonthBalance, 0) : Math.max(missingAmount, targetEndMonthBalance - effectiveProjected, 0);
  const commitmentHealth = Math.max(0, 100 - Math.min(100, commitmentRatio));
  const outer = ringOffset(45, score);
  const middle = ringOffset(36, targetProgress);
  const inner = ringOffset(27, commitmentHealth);

  const saveTarget = () => {
    const parsed = Number(tempTarget.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) onUpdateTarget?.(parsed);
    setIsEditingTarget(false);
  };

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-black/[0.05] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-7">
      <div className={`pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full blur-3xl ${isTargetMet ? "bg-emerald-300/15" : "bg-amber-300/15"}`} />
      <div className="relative grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 110 110" aria-label={`Saúde financeira: ${score} pontos`}>
              {[45, 36, 27].map((radius) => <circle key={radius} cx="55" cy="55" r={radius} fill="none" stroke="#000" strokeOpacity="0.055" strokeWidth="6" />)}
              <circle cx="55" cy="55" r="45" fill="none" stroke="#FF2D55" strokeWidth="6" strokeLinecap="round" strokeDasharray={outer.circumference} strokeDashoffset={outer.offset} className="transition-all duration-1000" />
              <circle cx="55" cy="55" r="36" fill="none" stroke="#34C759" strokeWidth="6" strokeLinecap="round" strokeDasharray={middle.circumference} strokeDashoffset={middle.offset} className="transition-all duration-1000" />
              <circle cx="55" cy="55" r="27" fill="none" stroke="#007AFF" strokeWidth="6" strokeLinecap="round" strokeDasharray={inner.circumference} strokeDashoffset={inner.offset} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{score}</strong><span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-[#86868B]">pontos</span></div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#86868B]">Saúde financeira</span><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${isTargetMet ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{healthStatus || (isTargetMet ? "Meta protegida" : "Atenção no fechamento")}</span></div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Seu dinheiro, em uma leitura.</h2>
            <p className="mt-2 max-w-lg text-[11px] leading-relaxed text-[#6E6E73]">{executiveSummary || `O score combina liquidez, meta mensal e comprometimento da renda. Seu limite recomendado é ${commitmentCeiling}%.`}</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-medium text-[#6E6E73]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#FF2D55]" />Score {score}%</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#34C759]" />Meta {Math.round(targetProgress)}%</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#007AFF]" />Renda livre {commitmentHealth}%</span></div>
          </div>
        </div>

        <div className="rounded-[24px] border border-black/[0.05] bg-[#FAFAFA] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.11em] text-[#86868B]"><Target size={12} />Fechamento projetado</span>
            {isEditingTarget ? (
              <span className="flex items-center gap-1"><input type="number" value={tempTarget} onChange={(event) => setTempTarget(event.target.value)} className="w-20 rounded-lg border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold tabular-nums" autoFocus /><button type="button" onClick={saveTarget} className="rounded-lg bg-emerald-600 p-1.5 text-white"><Check size={11} /></button><button type="button" onClick={() => setIsEditingTarget(false)} className="rounded-lg bg-black/5 p-1.5 text-[#6E6E73]"><X size={11} /></button></span>
            ) : (
              <button type="button" onClick={() => { setTempTarget(String(targetEndMonthBalance)); setIsEditingTarget(true); }} className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-600">Meta R$ {formatCurrency(targetEndMonthBalance)} <Edit3 size={10} /></button>
            )}
          </div>
          <strong className={`mt-4 block text-3xl font-semibold tracking-tight tabular-nums ${isTargetMet ? "text-emerald-700" : "text-amber-700"}`}>R$ {formatCurrency(effectiveProjected)}</strong>
          <p className="mt-1 text-[10px] text-[#6E6E73]">{isTargetMet ? `${formatCurrency(margin)} acima da meta definida.` : `${formatCurrency(margin)} abaixo da meta definida.`}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className={`h-full rounded-full transition-all duration-700 ${isTargetMet ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.max(3, targetProgress)}%` }} /></div>
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onOpenSimulator} className="inline-flex items-center gap-1.5 rounded-full bg-[#1D1D1F] px-3.5 py-2 text-[10px] font-semibold text-white transition-transform active:scale-95"><Calculator size={12} /> Simular compra</button><button type="button" onClick={() => onDiscussWithAI(`Niko, explique meu score de ${score} pontos, o saldo projetado de R$ ${effectiveProjected.toFixed(2)} e como proteger minha meta.`)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-semibold text-blue-600 hover:bg-blue-50"><MessageCircle size={12} /> Discutir</button></div>
        </div>
      </div>

      <div className="relative mt-6 grid overflow-hidden rounded-[20px] border border-black/[0.05] bg-black/[0.05] sm:grid-cols-3">
        <MiniMetric icon={<TrendingUp size={13} className="text-blue-600" />} label="Saldo em conta" value={`R$ ${formatCurrency(mainBalance)}`} />
        <MiniMetric icon={<CreditCard size={13} className="text-indigo-600" />} label="Faturas em aberto" value={`R$ ${formatCurrency(totalInvoices)}`} />
        <MiniMetric icon={<Target size={13} className="text-rose-600" />} label="Compromissos pendentes" value={`R$ ${formatCurrency(pendingBills)}`} />
      </div>
    </section>
  );
}

function MiniMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-[#FAFAFA] px-4 py-3.5 sm:border-r sm:border-black/[0.05] sm:last:border-r-0"><div className="flex items-center gap-1.5 text-[9px] font-medium text-[#86868B]">{icon}{label}</div><strong className="mt-1.5 block text-sm font-semibold tracking-tight tabular-nums text-slate-900">{value}</strong></div>;
}
