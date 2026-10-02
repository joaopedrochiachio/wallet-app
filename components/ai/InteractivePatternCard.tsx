"use client";

import React, { useState } from "react";
import {
  UtensilsCrossed,
  Car,
  Tv,
  ShoppingBag,
  Zap,
  Trash2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Target,
} from "lucide-react";
import { SpecificExpenseAlert } from "@/app/api/ai/analyze/route";
import { resolveAppleCategoryTheme } from "./CategorySpectrumBar";

interface InteractivePatternCardProps {
  item: SpecificExpenseAlert;
  targetGoalName?: string;
  onDismiss: (itemName: string) => void;
  onDiscuss: (prompt: string) => void;
}

export function InteractivePatternCard({
  item,
  targetGoalName,
  onDismiss,
  onDiscuss,
}: InteractivePatternCardProps) {
  const [selectedReduction, setSelectedReduction] = useState<number>(30); // Padrão: 30% de otimização
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const categoryTheme = resolveAppleCategoryTheme(item.habitCategory || item.item);

  // Ícone por categoria
  const getCategoryIcon = (category?: string, name?: string) => {
    const combined = `${category || ""} ${name || ""}`.toLowerCase();
    if (combined.includes("ifood") || combined.includes("aliment") || combined.includes("delivery") || combined.includes("burger") || combined.includes("mcdonald") || combined.includes("restaurante")) {
      return <UtensilsCrossed size={14} />;
    }
    if (combined.includes("uber") || combined.includes("transporte") || combined.includes("99") || combined.includes("combustivel") || combined.includes("posto")) {
      return <Car size={14} />;
    }
    if (combined.includes("netflix") || combined.includes("spotify") || combined.includes("streaming") || combined.includes("assinatura") || combined.includes("youtube") || combined.includes("prime")) {
      return <Tv size={14} />;
    }
    if (combined.includes("luz") || combined.includes("energia") || combined.includes("internet") || combined.includes("celular") || combined.includes("vivo")) {
      return <Zap size={14} />;
    }
    return <ShoppingBag size={14} />;
  };

  // Cálculo da simulação de economia
  const monthlySavings = (item.totalAmount * selectedReduction) / 100;
  const annualSavings = monthlySavings * 12;

  // Proporção crédito vs débito
  const credit = item.creditAmount || 0;
  const debit = item.debitAmount || 0;
  const hasSplit = credit > 0 || debit > 0;
  const totalSplit = credit + debit || item.totalAmount;
  const creditPct = totalSplit > 0 ? (credit / totalSplit) * 100 : 0;
  const debitPct = totalSplit > 0 ? (debit / totalSplit) * 100 : 0;

  return (
    <div className="bg-white rounded-[26px] p-5 border border-black/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.025)] hover:border-black/15 transition-all flex flex-col justify-between space-y-4 group">
      <div className="space-y-3">
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
              style={{ backgroundColor: `${categoryTheme.color}15`, color: categoryTheme.color }}
            >
              {getCategoryIcon(item.habitCategory, item.item)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                {item.item}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {item.habitCategory && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${categoryTheme.color}15`, color: categoryTheme.color }}
                  >
                    {item.habitCategory}
                  </span>
                )}
                {item.count && (
                  <span className="text-[10px] text-[#86868B] font-medium">
                    • {item.count} compra{item.count > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                item.alertType === "alert"
                  ? "bg-rose-50 text-rose-700 border-rose-200/60"
                  : item.alertType === "warning"
                  ? "bg-amber-50 text-amber-700 border-amber-200/60"
                  : "bg-blue-50 text-blue-700 border-blue-200/60"
              }`}
            >
              {item.alertType === "alert"
                ? "Ralo Financeiro"
                : item.alertType === "warning"
                ? "Atenção"
                : "Hábito Frequente"}
            </span>

            <button
              type="button"
              onClick={() => onDismiss(item.item)}
              title="Descartar este padrão"
              className="p-1 rounded-md text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Valor Total do Gasto */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#86868B] tracking-wider block">
              Impacto Atual
            </span>
            <div className="text-xl font-bold text-[#1D1D1F] font-mono tabular-nums">
              R$ {formatCurrency(item.totalAmount)}
            </div>
          </div>

          {/* Barra Proporcional Crédito vs Débito */}
          {hasSplit && (
            <div className="text-right space-y-1">
              <div className="text-[10px] text-[#86868B] font-mono">
                {credit > 0 && `Crédito R$ ${Math.round(credit)}`}
                {credit > 0 && debit > 0 && " • "}
                {debit > 0 && `PIX R$ ${Math.round(debit)}`}
              </div>
              <div className="h-1.5 w-24 bg-black/[0.04] rounded-full overflow-hidden flex ml-auto">
                {credit > 0 && (
                  <div
                    className="h-full bg-[#1D1D1F]"
                    style={{ width: `${creditPct}%` }}
                    title={`Crédito: ${creditPct.toFixed(0)}%`}
                  />
                )}
                {debit > 0 && (
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${debitPct}%` }}
                    title={`Débito/PIX: ${debitPct.toFixed(0)}%`}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Parecer do Analista */}
        <p className="text-xs text-[#86868B] leading-relaxed">
          {item.message}
        </p>

        {/* SIMULADOR DE OTIMIZAÇÃO (O GRANDE DIFERENCIAL INTERATIVO) */}
        <div className="pt-2 border-t border-black/[0.04] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#1D1D1F] flex items-center gap-1.5">
              <Sparkles size={12} className="text-purple-600" />
              <span>Simular Redução de Gasto:</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 font-mono">
              -{selectedReduction}%
            </span>
          </div>

          {/* Chips Táteis de Porcentagem Apple Style */}
          <div className="grid grid-cols-4 gap-1.5">
            {[15, 30, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setSelectedReduction(pct)}
                className={`py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedReduction === pct
                    ? "bg-[#1D1D1F] text-white shadow-xs scale-102"
                    : "bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                {pct === 100 ? "Zerar" : `-${pct}%`}
              </button>
            ))}
          </div>

          {/* Impacto da Redução Calculado ao Vivo */}
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/50 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
              <span className="flex items-center gap-1">
                <TrendingDown size={13} className="text-emerald-700" />
                <span>Economia Projetada:</span>
              </span>
              <span className="font-mono tabular-nums text-emerald-800">
                +R$ {formatCurrency(monthlySavings)}/mês
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-emerald-700">
              <span>Impacto anual acumulado:</span>
              <strong className="font-mono font-semibold">
                +R$ {formatCurrency(annualSavings)}/ano
              </strong>
            </div>

            {targetGoalName && (
              <div className="text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/40 flex items-center gap-1">
                <Target size={11} className="shrink-0 text-emerald-700" />
                <span className="truncate">
                  Acelera sua meta <strong>"{targetGoalName}"</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé com Ação Direta para o Chat */}
      <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between">
        <button
          type="button"
          onClick={() => onDismiss(item.item)}
          className="text-[11px] text-[#86868B] hover:text-rose-600 transition-colors cursor-pointer"
        >
          Descartar
        </button>

        <button
          type="button"
          onClick={() => {
            const prompt = `Gostaria de otimizar meus gastos com "${item.item}" (atualmente R$ ${item.totalAmount.toFixed(
              2
            )}/mês). Se eu reduzir ${selectedReduction}%, economizo R$ ${monthlySavings.toFixed(
              2
            )}/mês. Como posso atingir essa redução sem prejudicar minha rotina?`;
            onDiscuss(prompt);
          }}
          className="text-xs font-semibold text-[#1D1D1F] hover:text-black flex items-center gap-1 cursor-pointer bg-[#F2F2F7] hover:bg-[#E5E5EA] px-3 py-1.5 rounded-full transition-all active:scale-95"
        >
          <span>Planejar com IA</span>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
