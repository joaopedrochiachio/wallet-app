"use client";

import React, { useState } from "react";
import { Sparkles, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, CreditCard, Wallet, Calculator } from "lucide-react";

interface FinancialHealthRingProps {
  score: number;
  healthStatus?: string;
  commitmentRatio: number;
  commitmentCeiling: number;
  mainBalance: number;
  totalInvoices: number;
  pendingBills: number;
  executiveSummary?: string;
  onOpenSimulator: () => void;
  onDiscussWithAI: (topic: string) => void;
}

export function FinancialHealthRing({
  score,
  healthStatus,
  commitmentRatio,
  commitmentCeiling,
  mainBalance,
  totalInvoices,
  pendingBills,
  executiveSummary,
  onOpenSimulator,
  onDiscussWithAI,
}: FinancialHealthRingProps) {
  const [activePillar, setActivePillar] = useState<"overall" | "commitment" | "balance" | "invoices">("overall");

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Níveis de saúde Apple
  const getBadge = () => {
    if (score >= 80) {
      return {
        label: "Excelente",
        color: "text-emerald-700",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        ringColor: "#34C759",
      };
    }
    if (score >= 65) {
      return {
        label: "Saudável",
        color: "text-blue-700",
        bg: "bg-blue-500/10 border-blue-500/20",
        ringColor: "#007AFF",
      };
    }
    if (score >= 45) {
      return {
        label: "Requer Atenção",
        color: "text-amber-700",
        bg: "bg-amber-500/10 border-amber-500/20",
        ringColor: "#FF9500",
      };
    }
    return {
      label: "Alerta de Risco",
      color: "text-rose-700",
      bg: "bg-rose-500/10 border-rose-200/60",
      ringColor: "#FF3B30",
    };
  };

  const badge = getBadge();

  // Dimensões dos 3 Anéis de Atividade Apple Health
  // Anel 1 (Externo): Score Geral (raio 46, circunf ~289)
  // Anel 2 (Médio): Controle de Comprometimento (raio 36, circunf ~226)
  // Anel 3 (Interno): Liquidez vs Pendências (raio 26, circunf ~163)
  const ring1Pct = Math.min(100, Math.max(5, score));
  const ring2Pct = Math.min(100, Math.max(5, 100 - Math.min(100, (commitmentRatio / (commitmentCeiling || 60)) * 100)));
  const liquidityRatio = pendingBills > 0 ? (mainBalance / pendingBills) * 100 : 100;
  const ring3Pct = Math.min(100, Math.max(5, liquidityRatio));

  const c1 = 2 * Math.PI * 46; // ~289.02
  const c2 = 2 * Math.PI * 36; // ~226.19
  const c3 = 2 * Math.PI * 26; // ~163.36

  return (
    <section className="bg-white rounded-[28px] p-5 sm:p-7 border border-black/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-6">
      {/* 1. Header do Diagnóstico com Anéis Apple Fitness e Métricas Chave */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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

              {/* Anel 2 (Médio): Margem de Comprometimento (Azul Apple) */}
              <circle
                cx="55"
                cy="55"
                r="36"
                stroke="#007AFF"
                strokeWidth="6.5"
                strokeDasharray={c2}
                strokeDashoffset={c2 - (c2 * ring2Pct) / 100}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />

              {/* Anel 3 (Interno): Cobertura de Liquidez (Verde Esmeralda) */}
              <circle
                cx="55"
                cy="55"
                r="26"
                stroke="#34C759"
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
                Saúde Financeira
              </h2>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.color}`}>
                {badge.label}
              </span>
            </div>

            <p className="text-xs text-[#86868B] leading-relaxed max-w-sm">
              Auditoria em tempo real de liquidez disponível, comprometimento da renda e faturas em aberto.
            </p>

            {/* Legenda dos Anéis */}
            <div className="flex items-center gap-3 pt-1 text-[10px] text-[#86868B] flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: badge.ringColor }} />
                <span>Score ({score})</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                <span>Controle de Teto</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                <span>Liquidez</span>
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

      {/* 2. Grid de 3 Pilares Interativos Apple Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Pilar 1: Comprometimento */}
        <button
          type="button"
          onClick={() => setActivePillar(activePillar === "commitment" ? "overall" : "commitment")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePillar === "commitment"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.03]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">
              Comprometimento
            </span>
            <span className="text-[10px]">Teto {commitmentCeiling}%</span>
          </div>

          <div className="flex items-baseline gap-1.5 my-1">
            <strong
              className={`text-xl font-bold font-mono tabular-nums ${
                commitmentRatio > commitmentCeiling ? "text-rose-600" : "text-[#1D1D1F]"
              }`}
            >
              {commitmentRatio}%
            </strong>
            <span className="text-[11px] text-[#86868B]">
              {commitmentRatio <= commitmentCeiling ? "Margem Segura" : "Acima do Teto"}
            </span>
          </div>

          {/* Micro medidor de segurança */}
          <div className="h-1.5 w-full bg-black/[0.04] rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                commitmentRatio > commitmentCeiling ? "bg-rose-500" : "bg-[#007AFF]"
              }`}
              style={{ width: `${Math.min(100, Math.max(8, (commitmentRatio / (commitmentCeiling || 60)) * 100))}%` }}
            />
          </div>
        </button>

        {/* Pilar 2: Saldo em Conta */}
        <button
          type="button"
          onClick={() => setActivePillar(activePillar === "balance" ? "overall" : "balance")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePillar === "balance"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.03]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">
              Saldo em Conta
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">Disponível</span>
          </div>

          <div className="my-1">
            <strong className="text-xl font-bold text-emerald-600 font-mono tabular-nums truncate block">
              R$ {formatCurrency(mainBalance)}
            </strong>
          </div>

          {/* Micro indicador de liquidez */}
          <div className="text-[11px] text-[#86868B] flex items-center justify-between mt-2 pt-1 border-t border-black/[0.03]">
            <span>Pendências imediatas:</span>
            <span className="font-mono font-medium text-[#1D1D1F]">R$ {formatCurrency(pendingBills)}</span>
          </div>
        </button>

        {/* Pilar 3: Faturas em Aberto */}
        <button
          type="button"
          onClick={() => setActivePillar(activePillar === "invoices" ? "overall" : "invoices")}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activePillar === "invoices"
              ? "bg-white border-black/30 shadow-sm ring-1 ring-black/10"
              : "bg-[#FAFAFC] hover:bg-black/[0.02] border-black/[0.03]"
          }`}
        >
          <div className="flex items-center justify-between text-[#86868B] mb-1">
            <span className="text-[10px] uppercase font-semibold tracking-wider">
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

      {/* 3. Veredito Executivo do CFO Pessoal (Card de Alta Inteligência) */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F9F9FB] to-[#F2F2F7]/60 border border-black/[0.05] space-y-3">
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
            onClick={() => onDiscussWithAI("Explique em detalhes o que mais impactou minha saúde financeira este mês e como posso aumentar meu score.")}
            className="text-[11px] font-semibold text-[#007AFF] hover:underline cursor-pointer"
          >
            Aprofundar no Chat →
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#1D1D1F] leading-relaxed font-normal">
          {executiveSummary ||
            "Fluxo de caixa sob acompanhamento regular. Mantenha os vencimentos futuros sob observação para preservar sua liquidez."}
        </p>

        {/* 3 Insights Táticos Rápidos da IA */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-black/[0.04] text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/15">
            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
            <span className="truncate">Saldo líquido cobre contas imediatas</span>
          </div>

          <div className="flex items-center gap-1.5 text-blue-800 bg-blue-500/10 px-2.5 py-1.5 rounded-xl border border-blue-500/15">
            <TrendingUp size={12} className="text-blue-600 shrink-0" />
            <span className="truncate">Fatura representa {commitmentRatio}% da renda</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-800 bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/15">
            <AlertTriangle size={12} className="text-amber-600 shrink-0" />
            <span className="truncate">Oportunidade em hábitos recorrentes</span>
          </div>
        </div>
      </div>
    </section>
  );
}
