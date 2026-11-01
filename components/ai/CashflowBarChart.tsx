"use client";

import React, { useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, Rows3 } from "lucide-react";

interface CashflowBarChartProps {
  currentMonthName: string;
  currentBalance: number;
  currentPending: number;
  currentFree: number;
  nextMonthName: string;
  nextIncome: number;
  nextExpenses: number;
  nextFree: number;
  fortnightData?: {
    firstFortnightBills: number;
    secondFortnightBills: number;
    firstFortnightIncome?: number;
    secondFortnightIncome?: number;
  };
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function CashflowBarChart({
  currentMonthName,
  currentBalance,
  currentPending,
  currentFree,
  nextMonthName,
  nextIncome,
  nextExpenses,
  nextFree,
  fortnightData,
}: CashflowBarChartProps) {
  const [viewMode, setViewMode] = useState<"monthly" | "fortnight">("monthly");
  const freeDelta = nextFree - currentFree;
  const firstFortnightBills = fortnightData?.firstFortnightBills ?? currentPending * 0.6;
  const secondFortnightBills = fortnightData?.secondFortnightBills ?? currentPending * 0.4;
  const firstFortnightIncome = fortnightData?.firstFortnightIncome ?? 0;
  const secondFortnightIncome = fortnightData?.secondFortnightIncome ?? 0;

  return (
    <section className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-[30px] border border-black/[0.05] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
      <header className="flex flex-col gap-3 border-b border-black/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#1D1D1F] text-white"><Rows3 size={16} /></div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">Fluxo de caixa</h2>
            <p className="text-[11px] text-[#86868B]">Comparativo compacto entre o ciclo atual e o próximo.</p>
          </div>
        </div>
        <div className="flex self-start rounded-xl bg-[#F2F2F7] p-1 sm:self-auto">
          <ViewButton active={viewMode === "monthly"} onClick={() => setViewMode("monthly")}>Mensal</ViewButton>
          <ViewButton active={viewMode === "fortnight"} onClick={() => setViewMode("fortnight")}>Quinzenas</ViewButton>
        </div>
      </header>

      {viewMode === "monthly" ? (
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <MonthPanel title={currentMonthName} eyebrow="Ciclo atual" incomeLabel="Saldo em conta" income={currentBalance} expense={currentPending} free={currentFree} accent="#007AFF" />
            <MonthPanel title={nextMonthName} eyebrow="Próximo ciclo" incomeLabel="Entradas previstas" income={nextIncome} expense={nextExpenses} free={nextFree} accent="#34C759" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-[16px] bg-[#F5F5F7] px-3.5 py-3">
            <span className="flex items-center gap-2 text-[10px] text-[#555]">
              {freeDelta >= 0 ? <ArrowUpRight size={14} className="text-emerald-600" /> : <ArrowDownRight size={14} className="text-rose-600" />}
              O próximo ciclo {freeDelta >= 0 ? "ganha" : "perde"} {formatCurrency(Math.abs(freeDelta))} de margem.
            </span>
            <strong className={`whitespace-nowrap text-[11px] font-semibold tabular-nums ${nextFree >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{formatCurrency(nextFree)} livres</strong>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <FortnightPanel label="Dias 01 a 15" income={firstFortnightIncome} bills={firstFortnightBills} />
          <FortnightPanel label="Dias 16 ao fim" income={secondFortnightIncome} bills={secondFortnightBills} />
        </div>
      )}
    </section>
  );
}

function MonthPanel({ title, eyebrow, incomeLabel, income, expense, free, accent }: { title: string; eyebrow: string; incomeLabel: string; income: number; expense: number; free: number; accent: string }) {
  const base = Math.max(income, expense, 1);
  const margin = income > 0 ? Math.round((Math.max(0, free) / income) * 100) : 0;
  return (
    <div className="rounded-[22px] border border-black/[0.05] bg-[#FAFAFA] p-4">
      <div className="flex items-start justify-between gap-2">
        <div><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#86868B]">{eyebrow}</span><h3 className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900">{title}</h3></div>
        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold tabular-nums text-[#6E6E73] shadow-sm">{margin}% livre</span>
      </div>
      <div className="mt-5 space-y-3">
        <MetricLine label={incomeLabel} value={income} width={(income / base) * 100} color={accent} />
        <MetricLine label="Compromissos" value={expense} width={(expense / base) * 100} color="#FF3B30" />
      </div>
      <div className="mt-5 border-t border-black/[0.05] pt-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#86868B]">Saldo livre</span>
        <strong className={`mt-1 block text-xl font-semibold tracking-tight tabular-nums ${free >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{formatCurrency(free)}</strong>
      </div>
    </div>
  );
}

function MetricLine({ label, value, width, color }: { label: string; value: number; width: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[10px] text-[#6E6E73]">{label}</span><strong className="text-[10px] font-semibold tabular-nums text-slate-900">{formatCurrency(value)}</strong></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(2, width))}%`, backgroundColor: color }} /></div>
    </div>
  );
}

function FortnightPanel({ label, income, bills }: { label: string; income: number; bills: number }) {
  const balance = income - bills;
  return (
    <div className="rounded-[22px] border border-black/[0.05] bg-[#FAFAFA] p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900"><CalendarRange size={14} />{label}</div>
      <div className="mt-5 space-y-3"><MetricLine label="Entradas" value={income} width={income > 0 ? 100 : 2} color="#007AFF" /><MetricLine label="Contas" value={bills} width={bills > 0 ? 100 : 2} color="#FF3B30" /></div>
      <div className="mt-5 border-t border-black/[0.05] pt-3"><span className="text-[9px] uppercase tracking-[0.1em] text-[#86868B]">Saldo da quinzena</span><strong className={`mt-1 block text-lg font-semibold tabular-nums ${balance >= 0 ? "text-emerald-700" : "text-rose-600"}`}>{formatCurrency(balance)}</strong></div>
    </div>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all ${active ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B] hover:text-[#1D1D1F]"}`}>{children}</button>;
}
