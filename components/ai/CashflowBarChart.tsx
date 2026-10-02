"use client";

import React, { useState } from "react";
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Layers, Info } from "lucide-react";

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
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Valores máximos para escala proporcional perfeita
  const maxMonthlyVal = Math.max(
    currentBalance,
    currentPending,
    Math.max(0, currentFree),
    nextIncome,
    nextExpenses,
    Math.max(0, nextFree),
    100
  );

  const f1Bills = fortnightData?.firstFortnightBills || currentPending * 0.6;
  const f2Bills = fortnightData?.secondFortnightBills || currentPending * 0.4;
  const maxFortnight = Math.max(f1Bills, f2Bills, 100);

  // Margem de sobra no próximo mês
  const nextMarginPct = nextIncome > 0 ? Math.round((Math.max(0, nextFree) / nextIncome) * 100) : 0;
  const freeDelta = nextFree - currentFree;

  return (
    <div className="bg-white rounded-[28px] p-5 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-5">
      {/* Header com Segmented Control Apple */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1D1D1F] text-white flex items-center justify-center shadow-xs">
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Fluxo & Liquidez Auditada
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Gráfico comparativo de entradas, saídas e margem livre líquida
            </p>
          </div>
        </div>

        {/* Segmented Control Apple */}
        <div className="flex items-center p-1 bg-[#F2F2F7] rounded-full border border-black/[0.04] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("monthly")}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
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
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              viewMode === "fortnight"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Quinzenas
          </button>
        </div>
      </div>

      {viewMode === "monthly" ? (
        <div className="space-y-4">
          {/* Gráfico Visual em Colunas Lado a Lado (True Financial Flow) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco 1: Mês Atual */}
            <div className="p-4.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#86868B]" />
                  <span>{currentMonthName} (Ciclo Atual)</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                  Em Andamento
                </span>
              </div>

              {/* Colunas Verticais em SVG */}
              <div className="h-40 flex items-end justify-between gap-3 pt-4 pb-2 px-3 border-b border-black/[0.04]">
                {/* Coluna 1: Saldo */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-[#007AFF] font-bold">
                    R$ {Math.round(currentBalance)}
                  </span>
                  <div
                    className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(12, (currentBalance / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#86868B]">Saldo</span>
                </div>

                {/* Coluna 2: Pendências */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-rose-600 font-bold">
                    R$ {Math.round(currentPending)}
                  </span>
                  <div
                    className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-700 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(12, (currentPending / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#86868B]">Contas</span>
                </div>

                {/* Coluna 3: Sobra Projetada */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-emerald-700 font-bold">
                    R$ {Math.round(currentFree)}
                  </span>
                  <div
                    className={`w-full max-w-[42px] rounded-t-xl transition-all duration-700 shadow-2xs ${
                      currentFree >= 0
                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                        : "bg-gradient-to-t from-rose-600 to-rose-400"
                    }`}
                    style={{ height: `${Math.min(100, Math.max(12, (Math.abs(currentFree) / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#1D1D1F] font-semibold">Sobra</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-[#86868B]">
                <span>Sobra líquida atual:</span>
                <strong className={`font-mono ${currentFree >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  R$ {formatCurrency(currentFree)}
                </strong>
              </div>
            </div>

            {/* Bloco 2: Próximo Mês */}
            <div className="p-4.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  <span>{nextMonthName} (Próximo Ciclo)</span>
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                  Previsão IA
                </span>
              </div>

              {/* Colunas Verticais em SVG */}
              <div className="h-40 flex items-end justify-between gap-3 pt-4 pb-2 px-3 border-b border-black/[0.04]">
                {/* Coluna 1: Entradas */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-[#007AFF] font-bold">
                    R$ {Math.round(nextIncome)}
                  </span>
                  <div
                    className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(12, (nextIncome / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#86868B]">Entradas</span>
                </div>

                {/* Coluna 2: Compromissos */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-rose-600 font-bold">
                    R$ {Math.round(nextExpenses)}
                  </span>
                  <div
                    className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-rose-600 to-rose-400 transition-all duration-700 shadow-2xs"
                    style={{ height: `${Math.min(100, Math.max(12, (nextExpenses / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#86868B]">Compromissos</span>
                </div>

                {/* Coluna 3: Sobra Projetada */}
                <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                  <span className="text-[10px] font-mono tabular-nums text-emerald-700 font-bold">
                    R$ {Math.round(nextFree)}
                  </span>
                  <div
                    className={`w-full max-w-[42px] rounded-t-xl transition-all duration-700 shadow-2xs ${
                      nextFree >= 0
                        ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                        : "bg-gradient-to-t from-rose-600 to-rose-400"
                    }`}
                    style={{ height: `${Math.min(100, Math.max(12, (Math.abs(nextFree) / maxMonthlyVal) * 100))}%` }}
                  />
                  <span className="text-[10px] font-medium text-[#1D1D1F] font-semibold">Sobra</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1 text-[#86868B]">
                <span>Margem livre estimada:</span>
                <strong className="text-emerald-700 font-mono">
                  R$ {formatCurrency(nextFree)} ({nextMarginPct}% da renda)
                </strong>
              </div>
            </div>
          </div>

          {/* Destaque da Análise da IA Conectada aos Dados */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Parecer da IA:</strong> Seu próximo mês terá uma margem livre de{" "}
                <strong>{nextMarginPct}%</strong> (R$ {formatCurrency(nextFree)}),{" "}
                {freeDelta >= 0
                  ? `aumentando sua liquidez em R$ ${formatCurrency(freeDelta)} comparado ao mês atual.`
                  : "com ligeira pressão por compras parceladas contratadas."}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Aba Quinzenal */
        <div className="p-5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-[#1D1D1F]">
                Concentração de Vencimentos por Quinzena
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Compara a saída de caixa nos primeiros 15 dias versus a segunda metade do mês
              </p>
            </div>

            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white border border-black/[0.06] text-[#1D1D1F]">
              Auditoria de Pressão
            </span>
          </div>

          {/* Gráfico Comparativo 1ª Quinzena vs 2ª Quinzena */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2 p-4 rounded-xl bg-white border border-black/[0.04]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                1ª Quinzena (Dias 01 a 15)
              </span>
              <div className="text-xl font-bold font-mono text-rose-600">
                R$ {formatCurrency(f1Bills)}
              </div>
              <div className="h-2.5 w-full bg-black/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(10, (f1Bills / maxFortnight) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-[#86868B] block">
                {f1Bills >= f2Bills ? "⚠️ Concentra maior volume de faturas/contas" : "Volume estável"}
              </span>
            </div>

            <div className="space-y-2 p-4 rounded-xl bg-white border border-black/[0.04]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B] block">
                2ª Quinzena (Dias 16 ao fim)
              </span>
              <div className="text-xl font-bold font-mono text-[#1D1D1F]">
                R$ {formatCurrency(f2Bills)}
              </div>
              <div className="h-2.5 w-full bg-black/[0.04] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D1D1F] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(10, (f2Bills / maxFortnight) * 100))}%` }}
                />
              </div>
              <span className="text-[10px] text-[#86868B] block">
                {f2Bills > f1Bills ? "⚠️ Faturas ou parcelas tardias pesadas" : "Pressão sob controle"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
