"use client";

import React, { useState } from "react";
import { CreditCard, Calendar, ChevronRight, Info } from "lucide-react";
import { InstallmentScheduleItem } from "@/app/api/ai/analyze/route";

interface InstallmentTimelineChartProps {
  schedule: InstallmentScheduleItem[];
  onSelectPeriod?: (period: string) => void;
}

export function InstallmentTimelineChart({
  schedule,
  onSelectPeriod,
}: InstallmentTimelineChartProps) {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (!schedule || schedule.length === 0) return null;

  const maxAmount = Math.max(...schedule.map((s) => s.cardInstallmentsAmount), 100);
  const selectedItem = schedule[selectedIdx] || schedule[0];

  return (
    <div className="bg-white rounded-[26px] p-5 sm:p-6 border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.025)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CreditCard size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
              Linha do Tempo de Faturas & Parcelas
            </h2>
            <p className="text-[11px] text-[#86868B]">
              Curva de descompressão do cartão nos próximos meses (toque para inspecionar)
            </p>
          </div>
        </div>

        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#F2F2F7] text-[#1D1D1F] self-start sm:self-auto">
          {schedule.length} meses mapeados
        </span>
      </div>

      {/* Gráfico de Colunas Interativo Apple Style */}
      <div className="pt-4 pb-2">
        <div className="flex items-end justify-between gap-2 h-36 px-2 border-b border-black/[0.05]">
          {schedule.map((item, idx) => {
            const heightPct = Math.max(15, (item.cardInstallmentsAmount / maxAmount) * 100);
            const isSelected = selectedIdx === idx;
            const isAlert = item.status === "alert";
            const isWarning = item.status === "warning";

            let barColor = "bg-[#1D1D1F]";
            if (isAlert) barColor = "bg-rose-500";
            else if (isWarning) barColor = "bg-amber-500";
            else barColor = "bg-emerald-500";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSelectedIdx(idx);
                  if (onSelectPeriod) onSelectPeriod(item.period);
                }}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
              >
                {/* Valor acima da barra */}
                <span
                  className={`text-[10px] font-mono tabular-nums transition-all ${
                    isSelected ? "font-bold text-[#1D1D1F] scale-105" : "text-[#86868B] opacity-75"
                  }`}
                >
                  R$ {Math.round(item.cardInstallmentsAmount)}
                </span>

                {/* Coluna Visual */}
                <div
                  className={`w-full max-w-[40px] rounded-t-xl transition-all duration-300 ${barColor} ${
                    isSelected
                      ? "ring-2 ring-black ring-offset-2 scale-102"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />

                {/* Rótulo do Mês */}
                <span
                  className={`text-[10px] font-medium truncate pt-1 ${
                    isSelected ? "font-semibold text-[#1D1D1F]" : "text-[#86868B]"
                  }`}
                >
                  {item.period.split("/")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe do Mês Selecionado */}
      {selectedItem && (
        <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-[#86868B]" />
              <strong className="text-xs text-[#1D1D1F]">
                Fatura de {selectedItem.period}
              </strong>
              {selectedItem.dueDateHint && (
                <span className="text-[10px] text-[#86868B]">
                  • {selectedItem.dueDateHint}
                </span>
              )}
            </div>

            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                selectedItem.status === "alert"
                  ? "bg-rose-50 text-rose-700 border-rose-200/60"
                  : selectedItem.status === "warning"
                  ? "bg-amber-50 text-amber-700 border-amber-200/60"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200/60"
              }`}
            >
              {selectedItem.status === "alert"
                ? "Pressão no Orçamento"
                : selectedItem.status === "warning"
                ? "Requer Atenção"
                : "Equilibrado"}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-[#1D1D1F] font-mono tabular-nums">
              R$ {formatCurrency(selectedItem.cardInstallmentsAmount)}
            </span>
            <span className="text-[11px] text-[#86868B]">
              em parcelas já contratadas neste vencimento
            </span>
          </div>

          <p className="text-xs text-[#86868B] leading-relaxed">
            {selectedItem.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
