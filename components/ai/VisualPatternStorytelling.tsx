"use client";

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Flame,
  Coffee,
  ShoppingBag,
  CreditCard,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  X,
  Calculator,
  Sliders,
  Percent,
  RefreshCw,
} from "lucide-react";
import { FinancialDiagnosis, SpecificExpenseAlert } from "@/lib/services/financialDiagnosisService";

interface VisualPatternStorytellingProps {
  diagnosis: FinancialDiagnosis | null;
  targetEndMonthBalance: number;
  effectiveProjectedFree: number;
  safeDailyAllowance: number;
  mainBalance: number;
  monthExpense: number;
  onDiscussWithAI: (prompt: string) => void;
  onOpenSimulator?: (params?: { description?: string; amount?: number }) => void;
  onDismissPattern?: (item: string) => void;
  onRefreshPatterns?: () => void;
  isSearchingPatterns?: boolean;
}

export function VisualPatternStorytelling({
  diagnosis,
  targetEndMonthBalance,
  effectiveProjectedFree,
  safeDailyAllowance,
  mainBalance,
  monthExpense,
  onDiscussWithAI,
  onOpenSimulator,
  onDismissPattern,
  onRefreshPatterns,
  isSearchingPatterns,
}: VisualPatternStorytellingProps) {
  const [selectedCluster, setSelectedCluster] = useState<"all" | "drains" | "recurring" | "habits">("all");
  const [simulatedCutPercent, setSimulatedCutPercent] = useState<number>(20);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const targetStatus = effectiveProjectedFree >= targetEndMonthBalance ? "on_track" : "at_risk";
  const safeMargin = Math.max(0, effectiveProjectedFree - targetEndMonthBalance);
  const missingAmount = Math.max(0, targetEndMonthBalance - effectiveProjectedFree);

  // Lista de alertas de despesas específicas
  const rawAlerts = diagnosis?.specificExpensesAlerts || [];

  // Padrões consolidados padrão caso a IA não tenha retornado nada ainda
  const displayAlerts: SpecificExpenseAlert[] = useMemo(() => {
    if (rawAlerts.length > 0) return rawAlerts;
    return [
      {
        item: "Delivery & Alimentação Externa",
        totalAmount: 284.5,
        count: 5,
        habitCategory: "Alimentação",
        alertType: "warning",
        message: "5 pedidos identificados nas últimas semanas. Representa o maior gasto variável discricionário.",
      },
      {
        item: "Assinaturas e Streaming",
        totalAmount: 119.8,
        count: 3,
        habitCategory: "Serviços Digitais",
        alertType: "info",
        message: "3 serviços de mídia debitados mensalmente. Verifique se todos estão em uso ativo.",
      },
      {
        item: "Micro-compras & Transporte por App",
        totalAmount: 94.2,
        count: 4,
        habitCategory: "Transporte",
        alertType: "info",
        message: "Pequenos deslocamentos frequentes somam valor relevante no fim do mês.",
      },
    ];
  }, [rawAlerts]);

  // Filtragem de clusters
  const filteredAlerts = useMemo(() => {
    if (selectedCluster === "all") return displayAlerts;
    if (selectedCluster === "drains") {
      return displayAlerts.filter((a) => a.totalAmount >= 100 || a.alertType === "alert");
    }
    if (selectedCluster === "recurring") {
      return displayAlerts.filter(
        (a) =>
          a.habitCategory?.toLowerCase().includes("serviço") ||
          a.habitCategory?.toLowerCase().includes("assinatura")
      );
    }
    if (selectedCluster === "habits") {
      return displayAlerts.filter(
        (a) =>
          a.habitCategory?.toLowerCase().includes("alimentação") ||
          a.habitCategory?.toLowerCase().includes("transporte")
      );
    }
    return displayAlerts;
  }, [displayAlerts, selectedCluster]);

  // Economia total em potencial com o corte simulado
  const totalDrainsAmount = displayAlerts.reduce((acc, a) => acc + (a.totalAmount || 0), 0);
  const potentialSavings = (totalDrainsAmount * simulatedCutPercent) / 100;
  const newProjectedBalance = effectiveProjectedFree + potentialSavings;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* 1. HERO CARD: O VEREDITO DO CICLO EM FORMATO VISUAL DIDÁTICO */}
      <section className="rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-white via-white/95 to-[#F8F8FC] border border-black/[0.06] shadow-[0_4px_24px_rgba(0,0,0,0.03)] p-5 sm:p-7 space-y-5 relative overflow-hidden">
        {/* Glow decorativo */}
        <div
          className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -z-0 ${
            targetStatus === "on_track"
              ? "bg-gradient-to-br from-emerald-400/10 via-teal-400/5 to-transparent"
              : "bg-gradient-to-br from-amber-400/10 via-rose-400/5 to-transparent"
          }`}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] pb-5">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs shrink-0 ${
                targetStatus === "on_track"
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-600 text-white"
              }`}
            >
              {targetStatus === "on_track" ? (
                <CheckCircle2 size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[#1D1D1F]">
                  Diagnóstico Contábil de Hábitos & Metas
                </h3>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    targetStatus === "on_track"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {targetStatus === "on_track" ? "Meta Atingida no Fechamento" : "Atenção no Fechamento"}
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-0.5">
                Storytelling executivo com base no seu livro-caixa e compromissos futuros.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const prompt = `Auditor, analise detalhadamente meu panorama financeiro: saldo projetado de R$ ${effectiveProjectedFree.toFixed(2)} vs meta de R$ ${targetEndMonthBalance.toFixed(2)}. Quais as 3 melhores ações para acelerar minha reserva?`;
                onDiscussWithAI(prompt);
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <MessageSquare size={13} />
              <span>Aprofundar no Chat</span>
            </button>
          </div>
        </div>

        {/* 3 PILARES DO VEREDITO EXECUTIVO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 relative z-10">
          {/* Pilar 1: Meta & Folga */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">
                1. Saldo no Fechamento
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  targetStatus === "on_track"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {targetStatus === "on_track" ? `+R$ ${formatCurrency(safeMargin)} Livre` : `-R$ ${formatCurrency(missingAmount)}`}
              </span>
            </div>
            <strong className="text-xl font-bold font-mono text-[#1D1D1F] block tabular-nums">
              R$ {formatCurrency(effectiveProjectedFree)}
            </strong>
            <p className="text-xs text-[#86868B] leading-relaxed">
              {targetStatus === "on_track"
                ? `Você está projetado para bater a meta de R$ ${formatCurrency(targetEndMonthBalance)} com sobra segura para o mês.`
                : `Faltam R$ ${formatCurrency(missingAmount)} para atingir a meta estipulada de fechar com R$ ${formatCurrency(targetEndMonthBalance)}.`}
            </p>
          </div>

          {/* Pilar 2: Teto Diário Seguro */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">
                2. Velocímetro Diário
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                Hoje
              </span>
            </div>
            <strong className="text-xl font-bold font-mono text-emerald-600 block tabular-nums">
              R$ {formatCurrency(safeDailyAllowance)}/dia
            </strong>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Gastando até esse valor por dia nos dias restantes, sua meta de R$ {formatCurrency(targetEndMonthBalance)} permanece 100% blindada.
            </p>
          </div>

          {/* Pilar 3: Blindagem da Conta */}
          <div className="p-4 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-wider">
                3. Blindagem de Caixa
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Crédito vs Conta
              </span>
            </div>
            <strong className="text-xl font-bold font-mono text-[#1D1D1F] block tabular-nums">
              R$ {formatCurrency(mainBalance)}
            </strong>
            <p className="text-xs text-[#86868B] leading-relaxed">
              Mantenha o saldo em conta reservado para as faturas e contas fixas imediatas antes de assumir novos parcelamentos.
            </p>
          </div>
        </div>
      </section>

      {/* 2. SIMULADOR DIDÁTICO DE OTIMIZAÇÃO ("O QUE ACONTECE SE EU CORTAR?") */}
      <section className="rounded-[28px] bg-white border border-black/[0.06] p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Calculator size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1D1D1F]">
                Simulador Dinâmico: O Poder de Pequenos Cortes
              </h4>
              <p className="text-[11px] text-[#86868B]">
                Arraste o slider para ver o impacto imediato de economizar nos ralos identificados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#86868B]">Redução em Ralos:</span>
            <span className="px-2.5 py-1 rounded-xl bg-[#1D1D1F] text-white font-mono font-bold text-xs">
              {simulatedCutPercent}%
            </span>
          </div>
        </div>

        {/* Slider tátil */}
        <div className="space-y-2">
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={simulatedCutPercent}
            onChange={(e) => setSimulatedCutPercent(Number(e.target.value))}
            className="w-full h-2 bg-[#E5E5EA] rounded-lg appearance-none cursor-pointer accent-[#1D1D1F]"
          />
          <div className="flex justify-between text-[10px] text-[#86868B] font-mono">
            <span>5% (Ajuste Leve)</span>
            <span>20% (Recomendado)</span>
            <span>50% (Corte Radical)</span>
          </div>
        </div>

        {/* Resultado Didático da Simulação */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/80 to-teal-50/60 border border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Economia Extra Calculada
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
                +R$ {formatCurrency(potentialSavings)}
              </strong>
              <span className="text-xs text-emerald-900 font-medium">
                de folga no mês
              </span>
            </div>
            <p className="text-xs text-emerald-950">
              Seu saldo de fechamento saltaria de <strong>R$ {formatCurrency(effectiveProjectedFree)}</strong> para{" "}
              <strong className="text-emerald-700">R$ {formatCurrency(newProjectedBalance)}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const prompt = `Auditor, se eu cortar ${simulatedCutPercent}% dos meus gastos com delivery e pequenos ralos, como posso aplicar a economia de R$ ${potentialSavings.toFixed(2)} para acelerar minhas metas?`;
              onDiscussWithAI(prompt);
            }}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Aplicar Estratégia no Chat
          </button>
        </div>
      </section>

      {/* 3. RADAR DE PADRÕES ESPECÍFICOS & HÁBITOS DE CONSUMO */}
      <section className="rounded-[28px] sm:rounded-[36px] bg-white border border-black/[0.06] p-5 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-rose-500" />
              <h3 className="text-base font-bold text-[#1D1D1F]">
                Hábitos Invisíveis & Ralos Identificados
              </h3>
            </div>
            <p className="text-xs text-[#86868B] mt-0.5">
              Micro-análises detectadas no seu comportamento de compras.
            </p>
          </div>

          {/* Filtros de Cluster */}
          <div className="flex items-center gap-1.5 bg-[#F2F2F7] p-1 rounded-2xl border border-black/5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedCluster("all")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCluster === "all" ? "bg-white text-[#1D1D1F] shadow-xs" : "text-[#86868B]"
              }`}
            >
              Todos ({displayAlerts.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCluster("drains")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCluster === "drains" ? "bg-white text-rose-700 shadow-xs" : "text-[#86868B]"
              }`}
            >
              Maiores Ralos
            </button>
            <button
              type="button"
              onClick={() => setSelectedCluster("habits")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCluster === "habits" ? "bg-white text-amber-700 shadow-xs" : "text-[#86868B]"
              }`}
            >
              Rotina & Alimentação
            </button>
          </div>
        </div>

        {/* Grade de Cartões Didáticos de Padrão */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
          {filteredAlerts.map((alert) => {
            const percentOfMargin =
              safeMargin > 0 ? Math.round((alert.totalAmount / safeMargin) * 100) : 100;

            return (
              <div
                key={alert.item}
                className="rounded-2xl p-4 bg-[#FAFAFC] hover:bg-white border border-black/[0.05] hover:border-black/15 transition-all shadow-2xs space-y-3 flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-black/5 text-[#1D1D1F]">
                      {alert.habitCategory || "Despesa"}
                    </span>
                    <strong className="text-sm font-mono font-bold text-rose-600 tabular-nums">
                      R$ {formatCurrency(alert.totalAmount)}
                    </strong>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#1D1D1F] group-hover:text-black">
                      {alert.item}
                    </h4>
                    <p className="text-xs text-[#86868B] leading-relaxed mt-1">
                      {alert.message}
                    </p>
                  </div>

                  {/* Impacto didático */}
                  <div className="p-2 rounded-xl bg-white border border-black/[0.04] text-[11px] text-[#6E6E73] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span>Impacto na Margem Livre:</span>
                      <strong className="font-bold text-[#1D1D1F]">{percentOfMargin}%</strong>
                    </div>
                    <div className="w-full bg-[#E5E5EA] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${Math.min(100, percentOfMargin)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Ações Rápidas Conectadas ao Chat */}
                <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const prompt = `Auditor, quero analisar detalhadamente o alerta de "${alert.item}" (total de R$ ${alert.totalAmount.toFixed(2)}). Qual o plano prático para reduzir esse custo no próximo ciclo?`;
                      onDiscussWithAI(prompt);
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-white hover:bg-[#F2F2F7] active:scale-95 text-[#1D1D1F] border border-black/[0.08] text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <MessageSquare size={12} className="text-blue-600" />
                    <span>Discutir com Consultor</span>
                  </button>

                  {onDismissPattern && (
                    <button
                      type="button"
                      onClick={() => onDismissPattern(alert.item)}
                      className="p-1.5 rounded-lg text-[#86868B] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Descartar este alerta"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
