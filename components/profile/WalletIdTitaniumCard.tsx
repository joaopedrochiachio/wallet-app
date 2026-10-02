"use client";

import React, { useState } from "react";
import { UserProfile, FinancialPersonaId, RiskToleranceId, AIToneId } from "@/types";
import { Sparkles, ArrowRightLeft, ShieldCheck, Award } from "lucide-react";

export interface PersonaInfo {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  emoji: string;
  tagline: string;
  accentColor: string;
  gradientBg: string;
}

export const PERSONA_METADATA: Record<FinancialPersonaId, PersonaInfo> = {
  optimizer: {
    id: "optimizer",
    title: "The Optimizer",
    subtitle: "Eficiência e otimização financeira",
    emoji: "⚡",
    tagline: "Maximizador de benefícios e menor custo financeiro",
    accentColor: "#34C759",
    gradientBg: "from-amber-400/20 via-emerald-400/20 to-transparent",
  },
  guardian: {
    id: "guardian",
    title: "The Guardian",
    subtitle: "Segurança e previsibilidade",
    emoji: "🛡️",
    tagline: "Proteção de reserva e blindagem de fluxo",
    accentColor: "#007AFF",
    gradientBg: "from-blue-500/20 via-cyan-400/20 to-transparent",
  },
  scaler: {
    id: "scaler",
    title: "The Scaler",
    subtitle: "Crescimento e oportunidades",
    emoji: "🚀",
    tagline: "Expansão patrimonial e alavancagem estratégica",
    accentColor: "#AF52DE",
    gradientBg: "from-purple-500/20 via-pink-400/20 to-transparent",
  },
  minimalist: {
    id: "minimalist",
    title: "The Minimalist",
    subtitle: "Simplicidade e independência",
    emoji: "🧘",
    tagline: "Frugalidade consciente e alta taxa de poupança",
    accentColor: "#30B0C7",
    gradientBg: "from-teal-400/20 via-emerald-300/20 to-transparent",
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
  // Modo de visualização: 'finance' (dados da conta/saldo) ou 'intelligence' (raio-x da IA)
  const [viewMode, setViewMode] = useState<"finance" | "intelligence">("finance");

  const currentPersona = userProfile.persona
    ? PERSONA_METADATA[userProfile.persona] || PERSONA_METADATA.optimizer
    : PERSONA_METADATA.optimizer;

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1C1C1E] via-[#2A2A2E] to-[#121213] border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.22)] p-6 sm:p-7 text-white font-sans transition-all duration-300">
      {/* Luz ambiente de titânio escovado */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-radial from-white/[0.08] via-white/[0.02] to-transparent blur-3xl pointer-events-none" />
      <div className={`absolute bottom-0 left-0 w-72 h-48 bg-gradient-to-tr ${currentPersona.gradientBg} blur-3xl pointer-events-none transition-all duration-500`} />

      {/* Marca d'água refinada Apple Wallet ID */}
      <div className="absolute top-5 right-6 text-white/[0.05] font-semibold text-2xl sm:text-3xl tracking-tighter select-none pointer-events-none font-mono">
        WALLET ID
      </div>

      <div className="relative z-10 space-y-5">
        {/* Linha 1: Chip EMV + Aproximação NFC + Badges Apple */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Microchip EMV Apple Card em Vetor */}
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-[#D4AF37]/80 via-[#F5E080] to-[#AA7C11] p-[2px] shadow-xs flex items-center justify-center">
              <div className="w-full h-full rounded-[4px] bg-[#1F1F21]/80 grid grid-cols-2 gap-[2px] p-[2px]">
                <div className="border border-[#F5E080]/60 rounded-[2px]" />
                <div className="border border-[#F5E080]/60 rounded-[2px]" />
                <div className="border border-[#F5E080]/60 rounded-[2px]" />
                <div className="border border-[#F5E080]/60 rounded-[2px]" />
              </div>
            </div>

            {/* Símbolo de aproximação Contactless / NFC */}
            <svg
              className="w-5 h-5 text-white/40 rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8.5 16.5a5 5 0 0 1 0-9" />
              <path d="M12 19a8.5 8.5 0 0 1 0-14" />
              <path d="M15.5 21.5a12 12 0 0 1 0-19" />
            </svg>
          </div>

          {/* Badge Wallet Pro & Botão de Alternância de Visão */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === "finance" ? "intelligence" : "finance")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:scale-95 border border-white/10 text-[11px] font-semibold tracking-wide text-white/90 transition-all cursor-pointer backdrop-blur-md"
              title="Alternar entre dados da conta e parâmetros de inteligência"
            >
              <ArrowRightLeft size={12} className="text-white/70" />
              <span>{viewMode === "finance" ? "Raio-X de IA" : "Visão Carteira"}</span>
            </button>

            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-amber-300/10 px-3 py-1.5 rounded-full border border-amber-400/30 text-xs font-semibold text-amber-300 shadow-2xs">
              <Award size={13} className="text-amber-400" />
              <span>Wallet Pro</span>
            </div>
          </div>
        </div>

        {/* Linha 2: Avatar com Emoji de Arquétipo e Identidade */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar Híbrido: Monograma Apple ID + Emoji 3D de Arquétipo com Anel de Inteligência */}
            <div className="relative shrink-0 group">
              {/* Anel de gradiente Apple Intelligence */}
              <div
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${currentPersona.accentColor}, #5856D6, #FF2D55)`,
                }}
              >
                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2C2C2E] to-[#1C1C1E] text-white font-semibold text-xl sm:text-2xl flex items-center justify-center border border-white/20 shadow-inner select-none">
                  {userProfile.avatarInitials}
                </div>
              </div>

              {/* Emoji flutuante característico do arquétipo com status pulsante */}
              <button
                type="button"
                onClick={onOpenArchetypeModal}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#1C1C1E] border-2 border-white/20 shadow-md flex items-center justify-center text-sm hover:scale-110 active:scale-95 transition-transform cursor-pointer"
                title={`Arquétipo: ${currentPersona.title} (Clique para alterar)`}
              >
                <span>{currentPersona.emoji}</span>
              </button>
            </div>

            {/* Informações Pessoais & Papel */}
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-white truncate">
                  {userProfile.name}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.08] text-[11px] font-medium text-white/80 border border-white/10">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  Verificado
                </span>
              </div>
              <p className="text-xs text-white/70 truncate flex items-center gap-1.5">
                <span>{userProfile.role}</span>
                <span className="text-white/30">•</span>
                <span className="text-white/50 font-mono text-[11px]">{userProfile.email}</span>
              </p>
            </div>
          </div>

          {/* Badge Interativo do Arquétipo com atalho para o modal */}
          <button
            type="button"
            onClick={onOpenArchetypeModal}
            className="self-start sm:self-center shrink-0 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer text-left shadow-2xs group"
          >
            <span className="text-base group-hover:scale-110 transition-transform">
              {currentPersona.emoji}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/95">
                  {currentPersona.title}
                </span>
                <Sparkles size={11} className="text-amber-400" />
              </div>
              <span className="text-[10px] text-white/50 block font-medium">
                Tocar para alterar
              </span>
            </div>
          </button>
        </div>

        {/* Linha 3: Conteúdo Dinâmico com Transição (Visão Carteira vs Raio-X de Inteligência) */}
        {viewMode === "finance" ? (
          /* Visão Financeira: 3 Colunas Horizontais Apple Card */
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.04] border border-white/[0.08] p-3 sm:p-4 text-center backdrop-blur-xs animate-in fade-in duration-200">
            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Renda Base
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                R$ {formatCurrency(userProfile.monthlyIncomeBase)}
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Cartões
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white tracking-tight mt-0.5 block truncate">
                {cardsCount} {cardsCount === 1 ? "ativo" : "ativos"}
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Saldo Atual
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                R$ {formatCurrency(mainBalance)}
              </span>
            </div>
          </div>
        ) : (
          /* Raio-X de Inteligência: Parâmetros Ativos de Análise da IA */
          <div className="grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] border border-white/[0.12] p-3 sm:p-4 text-center backdrop-blur-xs animate-in fade-in duration-200">
            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Tom do Advisor
              </span>
              <span className="text-xs sm:text-sm font-semibold text-indigo-300 tracking-tight mt-0.5 block truncate">
                {TONE_LABELS[userProfile.aiTone] || "Analítico Suíço"}
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Teto de Alerta
              </span>
              <span className="text-xs sm:text-sm font-semibold text-amber-300 tracking-tight mt-0.5 block truncate font-mono tabular-nums">
                {userProfile.maxCommitmentAlertPercent}% da renda
              </span>
            </div>

            <div className="px-1.5 sm:px-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45 block truncate">
                Perfil de Risco
              </span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-300 tracking-tight mt-0.5 block truncate">
                {RISK_LABELS[userProfile.riskTolerance] || "Equilibrado"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
