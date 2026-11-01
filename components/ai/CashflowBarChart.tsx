"use client";

import React, { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  Rows3,
} from "lucide-react";

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
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
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
  const nextMarginPercent =
    nextIncome > 0 ? Math.round((Math.max(0, nextFree) / nextIncome) * 100) : 0;
  const currentMarginPercent =
    currentBalance > 0
      ? Math.round((Math.max(0, currentFree) / currentBalance) * 100)
      : 0;
  const freeDelta = nextFree - currentFree;
  const firstFortnightBills =
    fortnightData?.firstFortnightBills ?? currentPending * 0.6;
  const secondFortnightBills =
    fortnightData?.secondFortnightBills ?? currentPending * 0.4;
  const firstFortnightIncome = fortnightData?.firstFortnightIncome ?? 0;
  const secondFortnightIncome = fortnightData?.secondFortnightIncome ?? 0;

  return (
    <section className="overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
      <header className="flex flex-col gap-3 border-b border-black/[0.05] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1D1D1F] text-white">
            <Rows3 size={15} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-[#1D1D1F]">
              Fluxo de caixa
            </h2>
            <p className="text-[11px] text-[#86868B]">
              O que entrou, o que já está comprometido e o que permanece livre.
            </p>
          </div>
        </div>

        <div className="flex self-start rounded-xl bg-[#F2F2F7] p-1 sm:self-auto">
          <ViewButton active={viewMode === "monthly"} onClick={() => setViewMode("monthly")}>
            Por mês
          </ViewButton>
          <ViewButton active={viewMode === "fortnight"} onClick={() => setViewMode("fortnight")}>
            Por quinzena
          </ViewButton>
        </div>
      </header>

      {viewMode === "monthly" ? (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[590px] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/[0.05] bg-[#FAFAFA]">
                  <th className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B] sm:px-7">
                    Movimento
                  </th>
                  <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B]">
                    {currentMonthName} · atual
                  </th>
                  <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B]">
                    {nextMonthName} · programado
                  </th>
                  <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B]">
                    Leitura
                  </th>
                </tr>
              </thead>
              <tbody>
                <FlowRow
                  label="Saldo / entradas"
                  current={currentBalance}
                  next={nextIncome}
                  status="Base do período"
                  tone="blue"
                />
                <FlowRow
                  label="Contas / compromissos"
                  current={currentPending}
                  next={nextExpenses}
                  status={nextExpenses > nextIncome ? "Acima das entradas" : "Dentro das entradas"}
                  tone="red"
                />
                <FlowRow
                  label="Saldo livre"
                  current={currentFree}
                  next={nextFree}
                  status={freeDelta >= 0 ? "Tendência de melhora" : "Tendência de queda"}
                  tone={nextFree >= 0 ? "green" : "red"}
                  strong
                />
                <tr>
                  <td className="px-5 py-3.5 text-[10px] font-semibold text-[#555] sm:px-7">
                    Margem livre
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[10px] text-[#555]">
                    {currentMarginPercent}%
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[10px] font-bold text-emerald-700">
                    {nextMarginPercent}%
                  </td>
                  <td className="px-4 py-3.5 text-[9px] text-[#86868B]">
                    Percentual disponível após compromissos
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 border-t border-black/[0.05] bg-[#FAFAFA] px-5 py-3.5 text-[10px] sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <span className="flex items-center gap-2 text-[#555]">
              {freeDelta >= 0 ? (
                <ArrowUpRight size={13} className="text-emerald-600" />
              ) : (
                <ArrowDownRight size={13} className="text-rose-600" />
              )}
              O próximo ciclo varia {formatCurrency(Math.abs(freeDelta))} em relação ao atual.
            </span>
            <span className="font-mono font-bold text-[#1D1D1F]">
              Saldo previsto: {formatCurrency(nextFree)}
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-black/[0.05] bg-[#FAFAFA]">
                {['Período', 'Entradas', 'Contas', 'Saldo do período', 'Situação'].map((label) => (
                  <th key={label} className="px-5 py-3 text-[9px] font-bold uppercase tracking-[0.08em] text-[#86868B] first:sm:px-7">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <FortnightRow
                label="Dias 01 a 15"
                income={firstFortnightIncome}
                bills={firstFortnightBills}
                highlighted={firstFortnightBills >= secondFortnightBills}
              />
              <FortnightRow
                label="Dias 16 ao fim"
                income={secondFortnightIncome}
                bills={secondFortnightBills}
                highlighted={secondFortnightBills > firstFortnightBills}
              />
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-all ${
        active ? "bg-white text-[#1D1D1F] shadow-sm" : "text-[#86868B] hover:text-[#1D1D1F]"
      }`}
    >
      {children}
    </button>
  );
}

function FlowRow({
  label,
  current,
  next,
  status,
  tone,
  strong = false,
}: {
  label: string;
  current: number;
  next: number;
  status: string;
  tone: "blue" | "red" | "green";
  strong?: boolean;
}) {
  const color =
    tone === "blue" ? "text-blue-700" : tone === "red" ? "text-rose-600" : "text-emerald-700";

  return (
    <tr className="border-b border-black/[0.045] last:border-b-0 hover:bg-[#FAFAFA]">
      <td className={`px-5 py-3.5 text-[10px] text-[#1D1D1F] sm:px-7 ${strong ? "font-bold" : "font-semibold"}`}>
        {label}
      </td>
      <td className={`px-4 py-3.5 font-mono text-[10px] ${color} ${strong ? "font-bold" : ""}`}>
        {formatCurrency(current)}
      </td>
      <td className={`px-4 py-3.5 font-mono text-[10px] ${color} font-bold`}>
        {formatCurrency(next)}
      </td>
      <td className="px-4 py-3.5">
        <span className="rounded-full bg-[#F2F2F7] px-2 py-1 text-[8.5px] font-semibold text-[#6E6E73]">
          {status}
        </span>
      </td>
    </tr>
  );
}

function FortnightRow({
  label,
  income,
  bills,
  highlighted,
}: {
  label: string;
  income: number;
  bills: number;
  highlighted: boolean;
}) {
  const balance = income - bills;

  return (
    <tr className="border-b border-black/[0.045] last:border-b-0">
      <td className="px-5 py-4 text-[10px] font-bold text-[#1D1D1F] first:sm:px-7">
        <span className="flex items-center gap-2"><CalendarRange size={12} />{label}</span>
      </td>
      <td className="px-5 py-4 font-mono text-[10px] text-blue-700">{formatCurrency(income)}</td>
      <td className="px-5 py-4 font-mono text-[10px] text-rose-600">{formatCurrency(bills)}</td>
      <td className={`px-5 py-4 font-mono text-[10px] font-bold ${balance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
        {formatCurrency(balance)}
      </td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8.5px] font-semibold ${highlighted ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {highlighted ? 'Maior concentração' : <><CheckCircle2 size={9} /> Menor pressão</>}
        </span>
      </td>
    </tr>
  );
}
