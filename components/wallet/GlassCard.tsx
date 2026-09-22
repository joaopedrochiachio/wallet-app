"use client";

import React from "react";
import { WalletCardData } from "@/types/wallet";
import { CardEMVChip, CardContactlessIcon } from "./CardEMVChip";
import { CardBrandLogo } from "./CardBrandLogo";
import { getCardVisualTheme } from "./cardTheme";

interface GlassCardProps {
  card: WalletCardData;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function GlassCard({
  card,
  className = "",
  onClick,
  interactive = true,
}: GlassCardProps) {
  const theme = getCardVisualTheme(card);

  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] aspect-[1.586/1] rounded-[28px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden border ${theme.border} backdrop-blur-xl ${
        interactive ? "cursor-pointer transition-all duration-300 active:scale-[0.98]" : ""
      } ${className}`}
      style={{
        background: theme.background,
        boxShadow: `0 20px 48px -12px ${theme.glowColor}, 0 2px 12px rgba(0,0,0,0.12)`,
      }}
    >
      {/* Internal Glass Reflection Sheen (diagonal light refraction) */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-white/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none rounded-[28px] -z-10" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none" />

      {/* HEADER: Title & Contactless */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `0 0 10px ${theme.accent}`,
            }}
          />
          <div>
            <h3 className={`text-sm font-semibold tracking-tight ${theme.textColor} drop-shadow-xs`}>
              {card.title}
            </h3>
            {card.subtitle && (
              <p className={`text-[10px] font-medium tracking-wider ${theme.mutedColor} uppercase`}>
                {card.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20">
            Glass
          </span>
          <CardContactlessIcon className={theme.mutedColor} />
        </div>
      </div>

      {/* MIDDLE: EMV Chip & Limit/Balance */}
      <div className="relative z-10 flex items-center justify-between my-auto">
        <CardEMVChip color={theme.chipColor} />

        {card.balance !== undefined && card.balance > 0 ? (
          <div className="text-right">
            <span className={`text-[9px] uppercase tracking-wider font-semibold ${theme.mutedColor} block`}>
              Saldo Disponível
            </span>
            <div className={`text-base font-semibold tracking-tight ${theme.textColor} drop-shadow-xs`}>
              R$ {card.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ) : card.limit !== undefined && card.limit > 0 ? (
          <div className="text-right">
            <span className={`text-[9px] uppercase tracking-wider font-semibold ${theme.mutedColor} block`}>
              Limite Disponível
            </span>
            <div className={`text-base font-semibold tracking-tight ${theme.textColor} drop-shadow-xs`}>
              R$ {Math.max(0, (card.limit || 0) - (card.spent || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ) : null}
      </div>

      {/* FOOTER: Number, Holder, Expiry, Brand */}
      <div className="relative z-10 space-y-2">
        <div className={`font-mono text-sm tracking-[0.22em] font-medium ${theme.textColor} drop-shadow-xs`}>
          {card.cardNumber || "•••• •••• •••• 8842"}
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="space-y-0.5">
            <span className={`text-[9px] uppercase tracking-widest font-semibold block ${theme.mutedColor}`}>
              TITULAR
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider block ${theme.textColor} drop-shadow-xs truncate max-w-[200px]`}>
              {card.holderName || "NOME DO CLIENTE"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-0.5 text-right">
              <span className={`text-[9px] uppercase tracking-widest font-semibold block ${theme.mutedColor}`}>
                VALIDADE
              </span>
              <span className={`text-xs font-mono font-medium block ${theme.textColor} drop-shadow-xs`}>
                {card.expirationDate || "09/31"}
              </span>
            </div>

            <CardBrandLogo brand={card.brand} className={theme.textColor} />
          </div>
        </div>
      </div>
    </div>
  );
}
