"use client";

import React, { useState } from "react";
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";

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
  const [activeBar, setActiveBar] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Cálculo de máximos para dimensionamento relativo das barras SVG
  const monthlyMax = Math.max(
    currentBalance,
    currentPending,
    Math.max(0, currentFree),
    nextIncome,
    nextExpenses,
    Math.max(0, nextFree),
    100
  );

  const f1Bills = fortnightData?.firstFortnightBills || (currentPending * 0.6);
  const f2Bills = fortnightData?.secondFortnightBills || (currentPending * 0.4);
  const f1Income = fortnightData?.firstFortnightIncome || (nextIncome * 0.7);
  const f2Income = fortnightData?.secondFortnightIncome || (nextIncome * 0.3);
  const fortnightMax = Math.max(f1Bills, f2Bills, f1Income, f2Income, 100);

  return (
    <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.025)] space-y-4">
      {/* Header com Segmented Control Apple */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-2xs">
            <TrendingUp size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Fluxo & Liquidez Interativa
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Balanço visual de receitas, despesas e sobra livre projetada
            </p>
          </div>
        </div>

        {/* Alternância Mensal vs Quinzenal */}
        <div className="flex items-center p-1 bg-[#F2F2F7] rounded-full border border-black/[0.04] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("monthly")}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              viewMode === "monthly"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Ciclo Mensal
          </button>
          <button
            type="button"
            onClick={() => setViewMode("fortnight")}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              viewMode === "fortnight"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Quinzenas
          </button>
        </div>
      </div>

      {/* Gráfico Visual */}
      {viewMode === "monthly" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Bloco Mês Atual */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                activeBar?.startsWith("curr")
                  ? "bg-black/[0.02] border-black/20"
                  : "bg-[#FAFAFC] border-black/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#86868B]" />
                  <span>{currentMonthName} (Atual)</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  Em Andamento
                </span>
              </div>

              {/* Barras de Progresso Horizontais Apple Health Style */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#86868B] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Saldo em Conta
                    </span>
                    <strong className="font-mono text-[#1D1D1F]">
                      R$ {formatCurrency(currentBalance)}
                    </strong>
                  </div>
                  <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(6, (currentBalance / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#86868B] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Pendências / Contas
                    </span>
                    <strong className="font-mono text-[#1D1D1F]">
                      R$ {formatCurrency(currentPending)}
                    </strong>
                  </div>
                  <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(6, (currentPending / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="pt-1 border-t border-black/[0.04]">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#1D1D1F] font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Sobra Líquida Projetada
                    </span>
                    <strong className={`font-mono ${currentFree >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      R$ {formatCurrency(currentFree)}
                    </strong>
                  </div>
                  <div className="h-2.5 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        currentFree >= 0 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(6, (Math.abs(currentFree) / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Próximo Mês */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                activeBar?.startsWith("next")
                  ? "bg-black/[0.02] border-black/20"
                  : "bg-[#FAFAFC] border-black/[0.03]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  <span>{nextMonthName} (Próximo)</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                  Previsão
                </span>
              </div>

              {/* Barras de Progresso Horizontais Apple Health Style */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#86868B] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Entradas Previstas
                    </span>
                    <strong className="font-mono text-[#1D1D1F]">
                      R$ {formatCurrency(nextIncome)}
                    </strong>
                  </div>
                  <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(6, (nextIncome / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#86868B] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Gastos Comprometidos
                    </span>
                    <strong className="font-mono text-[#1D1D1F]">
                      R$ {formatCurrency(nextExpenses)}
                    </strong>
                  </div>
                  <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(6, (nextExpenses / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="pt-1 border-t border-black/[0.04]">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#1D1D1F] font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Sobra Livre Projetada
                    </span>
                    <strong className={`font-mono ${nextFree >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      R$ {formatCurrency(nextFree)}
                    </strong>
                  </div>
                  <div className="h-2.5 w-full bg-black/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        nextFree >= 0 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(6, (Math.abs(nextFree) / monthlyMax) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Visão Quinzenal */
        <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.03] space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#1D1D1F]">Distribuição Quinzenal de Pressão</span>
            <span className="text-[#86868B] text-[11px]">Comparativo do ciclo</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 1ª Quinzena */}
            <div className="space-y-2 p-3.5 rounded-xl bg-white border border-black/[0.03]">
              <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                1ª Quinzena (Dias 1 a 15)
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Contas / Faturas:</span>
                  <strong className="font-mono text-rose-600">R$ {formatCurrency(f1Bills)}</strong>
                </div>
                <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(8, (f1Bills / fortnightMax) * 100))}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#86868B] pt-1">
                {f1Bills > f2Bills ? "⚠️ Maior concentração de vencimentos." : "Fluxo suave no início do mês."}
              </p>
            </div>

            {/* 2ª Quinzena */}
            <div className="space-y-2 p-3.5 rounded-xl bg-white border border-black/[0.03]">
              <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider block">
                2ª Quinzena (Dias 16 ao fim)
              </span>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#86868B]">Contas / Faturas:</span>
                  <strong className="font-mono text-[#1D1D1F]">R$ {formatCurrency(f2Bills)}</strong>
                </div>
                <div className="h-2 w-full bg-black/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1D1D1F] rounded-full"
                    style={{ width: `${Math.min(100, Math.max(8, (f2Bills / fortnightMax) * 100))}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-[#86868B] pt-1">
                {f2Bills > f1Bills ? "⚠️ Faturas ou parcelas mais pesadas no final." : "Pressão controlada na reta final."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
