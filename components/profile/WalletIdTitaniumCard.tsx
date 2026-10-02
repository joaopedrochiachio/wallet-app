"use client";

import React, { useState } from "react";
import { UserProfile, FinancialPersonaId, RiskToleranceId, AIToneId } from "@/types";
import { ArrowRightLeft, ShieldCheck, ChevronRight } from "lucide-react";

export interface PersonaInfo {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  categoryTag: string;
  tagline: string;
}

export const PERSONA_METADATA: Record<FinancialPersonaId, PersonaInfo> = {
  optimizer: {
    id: "optimizer",
    title: "The Optimizer",
    subtitle: "Eficiência e Otimização de Capital",
    categoryTag: "Eficiência de Crédito",
    tagline: "Maximizador de benefícios, prazos e menor custo financeiro",
  },
  guardian: {
    id: "guardian",
    title: "The Guardian",
    subtitle: "Preservação e Segurança de Caixa",
    categoryTag: "Reserva & Blindagem",
    tagline: "Proteção de liquidez de emergência e controle prudencial",
  },
  scaler: {
    id: "scaler",
    title: "The Scaler",
    subtitle: "Crescimento e Expansão Patrimonial",
    categoryTag: "Alavancagem Estratégica",
    tagline: "Canalização de excedentes para aportes e metas de longo prazo",
  },
  minimalist: {
    id: "minimalist",
    title: "The Minimalist",
    subtitle: "Frugalidade Consciente e Simplicidade",
    categoryTag: "Independência & Poupança",
    tagline: "Foco em despesas essenciais e alta taxa de poupança (FIRE)",
  },
};

const RISK_LABELS: Record<RiskToleranceId, string> = {
  low: "Conservador",
  moderate: "Equilibrado",
  high: "Arrojado",
};

const TONE_LABELS: Record<AIToneId, string> = {
  analytical: "Analítico Suíço",
  direct: "Mentor Direto",
  collaborative: "Parceiro Estratégico",
};

interface WalletIdTitaniumCardProps {
  userProfile: UserProfile;
  cardsCount: number;
  mainBalance: number;
  onOpenArchetypeModal: () => void;
  formatCurrency: (val: number) => string;
}

export function WalletIdTitaniumCard({
  userProfile,
  cardsCount,
  mainBalance,
  onOpenArchetypeModal,
  formatCurrency,
}: WalletIdTitaniumCardProps) {
  const [viewMode, setViewMode] = useState<"finance" | "intelligence">("finance");

  const currentPersona = userProfile.persona
    ? PERSONA_METADATA[userProfile.persona] || PERSONA_METADATA.optimizer
    : PERSONA_METADATA.optimizer;

  return (
    <div className="relative overflow-hidden rounded-[26px] bg-[#121214] border border-white/[0.12] shadow-[0_18px_45px_rgba(0,0,0,0.32)] p-6 sm:p-7 text-white font-sans transition-all duration-300">
      {/* Specular Edge Highlight Estilo MacBook Space Black */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 -mt-16 -mr-16 w-56 h-56 rounded-full bg-radial from-white/[0.04] to-transparent blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Linha 1: Top Bar Estilo Cartão Private Banking */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono tracking-[0.22em] uppercase text-white/50 font-medium">
              WALLET ID
            </span>
            <span className="text-white/20 font-mono text-[10px]">•</span>
            <span className="text-[10px] font-mono tracking-wider text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              CONTA ATIVA
            </span>
          </div>

          {/* Alternância Elegante: Visão Carteira vs Raio-X de IA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "finance" ? "intelligence" : "finance")}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 border border-white/10 text-[11px] font-medium tracking-tight text-white/80 transition-all cursor-pointer"
            >
              <ArrowRightLeft size={11} className="text-white/60" />
              <span>{viewMode === "finance" ? "Ver Parâmetros de IA" : "Ver Saldos"}</span>
            </button>
            <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono tracking-wider text-white/70">
              PRO
            </span>
          </div>
        </div>

        {/* Linha 2: Identidade do Usuário e Tag de Arquétipo Minimalista */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4 min-w-0">
            {/* Monograma Estilo Apple ID com Borda Metálica Fina */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-b from-[#242426] to-[#161618] text-white font-semibold text-lg sm:text-xl flex items-center justify-center border border-white/15 shadow-inner select-none font-mono">
                {userProfile.avatarInitials}
              </div>
            </div>

            {/* Informações Pessoais */}
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white truncate">
                  {userProfile.name}
                </h2>
                <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs text-white/60 truncate flex items-center gap-1.5 font-mono">
                <span>{userProfile.role || "Membro"}</span>
                <span className="text-white/30">•</span>
                <span className="text-white/40">{userProfile.email}</span>
              </p>
            </div>
          </div>

          {/* Badge Minimalista do Arquétipo Ativo */}
          <button
            type="button"
            onClick={onOpenArchetypeModal}
            className="self-start sm:self-center shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 transition-all active:scale-95 cursor-pointer text-left group"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white tracking-tight">
                  {currentPersona.title}
                </span>
                <ChevronRight size={12} className="text-white/40 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <span className="text-[10px] text-white/45 block font-mono">
                {currentPersona.categoryTag}
              </span>
            </div>
          </button>
        </div>

        {/* Linha 3: Métricas em Formato de Prateleira de Banco (MacBook / Apple Wallet) */}
        {viewMode === "finance" ? (
          <div className="grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4 text-center">
            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Renda Base
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                R$ {formatCurrency(userProfile.monthlyIncomeBase)}
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Cartões Ativos
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono">
                {cardsCount} {cardsCount === 1 ? "ativo" : "ativos"}
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Saldo Atual
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                R$ {formatCurrency(mainBalance)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-4 text-center">
            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Tom do Advisor
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono">
                {TONE_LABELS[userProfile.aiTone] || "Analítico Suíço"}
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Teto de Alerta
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                {userProfile.maxCommitmentAlertPercent}% da renda
              </span>
            </div>

            <div className="px-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 block truncate">
                Perfil de Risco
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono">
                {RISK_LABELS[userProfile.riskTolerance] || "Equilibrado"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
