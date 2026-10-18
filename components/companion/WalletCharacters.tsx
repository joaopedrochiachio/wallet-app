"use client";

import React from "react";

export type WalletCharacterId = "wallet-rubi" | "wallet-sol" | "wallet-nanquim" | "wallet-atlos";
export type CharacterId = WalletCharacterId;
export type CharacterState = "ocioso" | "pensando" | "ouvindo" | "alerta" | "sucesso" | "dormindo" | "falando";

interface WalletCharacterProps {
  id: WalletCharacterId | string;
  state?: CharacterState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBadge?: boolean;
  showGlow?: boolean;
}

export interface CharacterMeta {
  id: WalletCharacterId;
  name: string;
  title: string;
  role: string;
  primaryColor: string;
  glowColor: string;
  accentBg: string;
  badgeText: string;
  description: string;
}

export const WALLET_CHARACTERS: Record<WalletCharacterId, CharacterMeta> = {
  "wallet-rubi": {
    id: "wallet-rubi",
    name: "Rubi",
    title: "CFO & Estrategista",
    role: "Auditoria Executiva, Metas e Teto Diário",
    primaryColor: "#EF4444",
    glowColor: "rgba(239, 68, 68, 0.4)",
    accentBg: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    badgeText: "CFO",
    description: "Foco no saldo projetado, disciplina de caixa e cumprimento rigoroso da meta de fim de mês.",
  },
  "wallet-sol": {
    id: "wallet-sol",
    name: "Sol",
    title: "Guardiã da Reserva",
    role: "Liquidez, Proteção de Caixa e Sobrevivência",
    primaryColor: "#F59E0B",
    glowColor: "rgba(245, 158, 11, 0.4)",
    accentBg: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    badgeText: "Guardiã",
    description: "Blindagem da conta corrente, prevenção contra juros e manutenção da reserva de emergência.",
  },
  "wallet-nanquim": {
    id: "wallet-nanquim",
    name: "Nanquim",
    title: "Arquiteto de Crédito",
    role: "Cartões, Janela sem Juros e Rendimentos",
    primaryColor: "#3B82F6",
    glowColor: "rgba(59, 130, 246, 0.4)",
    accentBg: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    badgeText: "Crédito",
    description: "Otimização de datas de fechamento (+40 dias sem juros) e rendimento da conta corrente a 100% CDI.",
  },
  "wallet-atlos": {
    id: "wallet-atlos",
    name: "Atlos",
    title: "Mentor de Metas",
    role: "Hábitos, Streaks de Disciplina e Conquistas",
    primaryColor: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.4)",
    accentBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    badgeText: "Metas",
    description: "Gamificação dos gastos, corte de pequenos ralos diários e celebração de marcos financeiros.",
  },
};

/**
 * Normaliza qualquer persona antiga ('optimizer', 'guardian', etc.) para o ID oficial wallet-*
 */
export function normalizeCharacterId(id?: string): WalletCharacterId {
  if (!id) return "wallet-rubi";
  const s = id.toLowerCase().trim();
  if (s.includes("rubi") || s.includes("optimizer") || s.includes("cfo")) return "wallet-rubi";
  if (s.includes("sol") || s.includes("guardian")) return "wallet-sol";
  if (s.includes("nanquim") || s.includes("builder") || s.includes("credito")) return "wallet-nanquim";
  if (s.includes("atlos") || s.includes("atlas") || s.includes("scaler") || s.includes("metas")) return "wallet-atlos";
  return "wallet-rubi";
}

/**
 * Componente de Personagem Original do Ecossistema Wallet+ (Inspirado no Niko / Apple)
 */
export function WalletCharacter({
  id,
  state = "ocioso",
  size = "md",
  className = "",
  showBadge = true,
  showGlow = true,
}: WalletCharacterProps) {
  const charId = normalizeCharacterId(id);
  const meta = WALLET_CHARACTERS[charId];

  const sizePixel = {
    sm: 32,
    md: 44,
    lg: 56,
    xl: 72,
  }[size];

  // Renderizador vetorial dos 4 personagens com estados emocionais Apple/Niko
  const renderVectorCharacter = () => {
    switch (charId) {
      case "wallet-rubi":
        // Rubi: Cristal lapidado com visor HUD holográfico
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
            <defs>
              <linearGradient id="rubi-body" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%" stopColor="#F87171" />
                <stop offset="50%" stopColor="#DC2626" />
                <stop offset="100%" stopColor="#991B1B" />
              </linearGradient>
              <linearGradient id="rubi-visor" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="100%" stopColor="#38BDF8" />
              </linearGradient>
            </defs>

            {/* Faceta de fundo */}
            <polygon points="50,10 88,32 74,86 26,86 12,32" fill="url(#rubi-body)" stroke="#FCA5A5" strokeWidth="2.5" />
            <polygon points="50,10 50,48 12,32" fill="#EF4444" opacity="0.6" />
            <polygon points="50,10 88,32 50,48" fill="#B91C1C" opacity="0.6" />
            <polygon points="50,48 74,86 26,86" fill="#7F1D1D" opacity="0.8" />

            {/* Visor HUD holográfico dos olhos */}
            <rect x="25" y="38" width="50" height="18" rx="9" fill="#0A0D14" stroke="url(#rubi-visor)" strokeWidth="2" />

            {/* Olhos baseados no estado */}
            {state === "pensando" ? (
              <>
                <circle cx="40" cy="47" r="3.5" fill="#38BDF8" className="animate-ping" />
                <circle cx="60" cy="47" r="3.5" fill="#38BDF8" className="animate-ping" />
                <path d="M 33 42 L 67 42" stroke="#60A5FA" strokeWidth="1.5" strokeDasharray="3 2" />
              </>
            ) : state === "alerta" ? (
              <>
                <polygon points="40,43 45,51 35,51" fill="#FBBF24" />
                <polygon points="60,43 65,51 55,51" fill="#FBBF24" />
              </>
            ) : state === "sucesso" ? (
              <>
                <path d="M 34 48 Q 40 43 46 48" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 54 48 Q 60 43 66 48" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : state === "dormindo" ? (
              <>
                <path d="M 35 48 Q 40 50 45 48" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                <path d="M 55 48 Q 60 50 65 48" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : (
              // Ocioso / Ouvindo
              <>
                <circle cx="40" cy="47" r="3.5" fill="#60A5FA" />
                <circle cx="60" cy="47" r="3.5" fill="#60A5FA" />
                <circle cx="41.5" cy="45.5" r="1.2" fill="#FFFFFF" />
                <circle cx="61.5" cy="45.5" r="1.2" fill="#FFFFFF" />
              </>
            )}
          </svg>
        );

      case "wallet-sol":
        // Sol: Orbe solar caloroso com auréola Apple
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
            <defs>
              <linearGradient id="sol-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="60%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#D97706" />
              </linearGradient>
            </defs>

            {/* Raios sutis circulares */}
            <circle cx="50" cy="50" r="44" stroke="#FDE68A" strokeWidth="2" strokeDasharray="4 6" opacity="0.7" />
            <circle cx="50" cy="50" r="36" fill="url(#sol-body)" stroke="#FEF08A" strokeWidth="2" />

            {/* Olhos expressivos acolhedores */}
            {state === "pensando" ? (
              <>
                <ellipse cx="42" cy="46" rx="4" ry="2" fill="#78350F" />
                <ellipse cx="58" cy="46" rx="4" ry="2" fill="#78350F" />
                <circle cx="50" cy="58" r="3" fill="#B45309" />
              </>
            ) : state === "sucesso" ? (
              <>
                <path d="M 37 46 Q 42 41 47 46" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 53 46 Q 58 41 63 46" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 43 56 Q 50 62 57 56" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
              </>
            ) : state === "alerta" ? (
              <>
                <circle cx="42" cy="46" r="4" fill="#B91C1C" />
                <circle cx="58" cy="46" r="4" fill="#B91C1C" />
                <ellipse cx="50" cy="57" rx="3" ry="5" fill="#78350F" />
              </>
            ) : (
              <>
                <circle cx="42" cy="46" r="4" fill="#78350F" />
                <circle cx="58" cy="46" r="4" fill="#78350F" />
                <circle cx="43.5" cy="44.5" r="1.5" fill="#FFFFFF" />
                <circle cx="59.5" cy="44.5" r="1.5" fill="#FFFFFF" />
                <path d="M 44 56 Q 50 60 56 56" stroke="#78350F" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        );

      case "wallet-nanquim":
        // Nanquim: Safira espacial com anéis orbitais giratórios
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
            <defs>
              <linearGradient id="nanquim-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60A5FA" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </linearGradient>
            </defs>

            {/* Anéis orbitais de crédito */}
            <ellipse cx="50" cy="50" rx="46" ry="16" stroke="#93C5FD" strokeWidth="2" transform="rotate(-25 50 50)" opacity="0.6" />
            <circle cx="50" cy="50" r="32" fill="url(#nanquim-body)" stroke="#BFDBFE" strokeWidth="2" />

            {/* Olhos cibernéticos de alta precisão */}
            {state === "pensando" ? (
              <>
                <rect x="36" y="44" width="10" height="4" rx="2" fill="#E0E7FF" className="animate-pulse" />
                <rect x="54" y="44" width="10" height="4" rx="2" fill="#E0E7FF" className="animate-pulse" />
              </>
            ) : state === "sucesso" ? (
              <>
                <path d="M 37 47 Q 42 42 47 47" stroke="#E0E7FF" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 53 47 Q 58 42 63 47" stroke="#E0E7FF" strokeWidth="2.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <circle cx="42" cy="47" r="3.5" fill="#DBEAFE" />
                <circle cx="58" cy="47" r="3.5" fill="#DBEAFE" />
                <circle cx="43" cy="45.5" r="1.2" fill="#1E40AF" />
                <circle cx="59" cy="45.5" r="1.2" fill="#1E40AF" />
                <rect x="46" y="55" width="8" height="2" rx="1" fill="#93C5FD" />
              </>
            )}
          </svg>
        );

      case "wallet-atlos":
        // Atlos: Hexágono esmeralda dinâmico com insígnia de metas
        return (
          <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
            <defs>
              <linearGradient id="atlos-body" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064E3B" />
              </linearGradient>
            </defs>

            {/* Hexágono com bevel */}
            <polygon points="50,12 84,30 84,70 50,88 16,70 16,30" fill="url(#atlos-body)" stroke="#A7F3D0" strokeWidth="2.5" />

            {/* Olhos com foco e energia */}
            {state === "pensando" ? (
              <>
                <circle cx="41" cy="46" r="3.5" fill="#A7F3D0" className="animate-pulse" />
                <circle cx="59" cy="46" r="3.5" fill="#A7F3D0" className="animate-pulse" />
              </>
            ) : state === "sucesso" ? (
              <>
                <polygon points="50,38 53,44 60,45 55,50 56,56 50,53 44,56 45,50 40,45 47,44" fill="#FDE047" />
              </>
            ) : (
              <>
                <circle cx="41" cy="46" r="4" fill="#ECFDF5" />
                <circle cx="59" cy="46" r="4" fill="#ECFDF5" />
                <circle cx="42.5" cy="44.5" r="1.5" fill="#047857" />
                <circle cx="60.5" cy="44.5" r="1.5" fill="#047857" />
                <path d="M 44 56 Q 50 60 56 56" stroke="#D1FAE5" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 group ${className}`}
      style={{ width: sizePixel, height: sizePixel }}
      title={`${meta.name} (${meta.title}) • Estado: ${state}`}
    >
      {/* Halo de Brilho Apple Glass */}
      {showGlow && (
        <div
          className="absolute inset-0 rounded-2xl blur-md -z-10 transition-opacity duration-300 opacity-40 group-hover:opacity-80"
          style={{ background: meta.glowColor }}
        />
      )}

      {/* Caixa do Personagem */}
      <div className="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center transition-transform duration-300 group-hover:scale-105 active:scale-95">
        {renderVectorCharacter()}
      </div>

      {/* Micro-badge de Cargo */}
      {showBadge && (
        <span
          className="absolute -bottom-1 -right-1 text-[8px] font-bold font-mono px-1 py-0.2 rounded-full border border-black/20 text-white shadow-xs"
          style={{ backgroundColor: meta.primaryColor }}
        >
          {meta.badgeText}
        </span>
      )}
    </div>
  );
}
