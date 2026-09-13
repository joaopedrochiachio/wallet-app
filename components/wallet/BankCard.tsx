"use client";

import React from "react";
import { WalletCardData } from "@/types/wallet";
import { CardEMVChip, CardContactlessIcon } from "./CardEMVChip";
import { CardBrandLogo } from "./CardBrandLogo";
import { getCardVisualTheme } from "./cardTheme";

interface BankCardProps {
  card: WalletCardData;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

export function BankCard({
  card,
  className = "",
  onClick,
  interactive = true,
}: BankCardProps) {
  const theme = getCardVisualTheme(card);

  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] aspect-[1.586/1] rounded-[26px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl border ${theme.border} ${
        interactive ? "cursor-pointer transition-all duration-300 active:scale-[0.98]" : ""
      } ${className}`}
      style={{
        background: theme.background,
        boxShadow: `0 14px 36px -10px ${theme.glowColor}, 0 2px 10px rgba(0,0,0,0.06)`,
      }}
    >
      {/* Specular light highlight on top-left edge */}
      <div className="absolute -top-24 -left-24 w-60 h-60 bg-white/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none rounded-[26px]" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      {/* HEADER: Title & Contactless */}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <h3 className={`text-sm font-semibold tracking-tight ${theme.textColor}`}>
            {card.title}
          </h3>
          {card.subtitle && (
            <p className={`text-[11px] font-medium tracking-wide ${theme.mutedColor}`}>
              {card.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CardContactlessIcon className={theme.mutedColor} />
        </div>
      </div>

      {/* MIDDLE: EMV Chip & Balance/Limit */}
      <div className="relative z-10 flex items-center justify-between my-auto">
        <CardEMVChip color={theme.chipColor} />

        {card.balance !== undefined && card.balance > 0 ? (
          <div className="text-right">
            <span className={`text-[9px] uppercase tracking-wider font-semibold ${theme.mutedColor} block`}>
              Saldo Disponível
            </span>
            <div className={`text-base font-semibold tracking-tight ${theme.textColor}`}>
              R$ {card.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ) : card.limit !== undefined && card.limit > 0 ? (
          <div className="text-right">
            <span className={`text-[9px] uppercase tracking-wider font-semibold ${theme.mutedColor} block`}>
              Limite Disponível
            </span>
            <div className={`text-base font-semibold tracking-tight ${theme.textColor}`}>
              R$ {((card.limit || 0) - (card.spent || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ) : null}
      </div>

      {/* FOOTER: Number, Holder, Expiry, Brand Logo */}
      <div className="relative z-10 space-y-2">
        {/* Card Number */}
        <div className={`font-mono text-sm tracking-[0.22em] font-medium ${theme.textColor}`}>
          {card.cardNumber || "•••• •••• •••• 4892"}
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="space-y-0.5">
            <span className={`text-[9px] uppercase tracking-widest font-semibold block ${theme.mutedColor}`}>
              TITULAR
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider block ${theme.textColor} truncate max-w-[200px]`}>
              {card.holderName || "NOME DO CLIENTE"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-0.5 text-right">
              <span className={`text-[9px] uppercase tracking-widest font-semibold block ${theme.mutedColor}`}>
                VALIDADE
              </span>
              <span className={`text-xs font-mono font-medium block ${theme.textColor}`}>
                {card.expirationDate || "12/29"}
              </span>
            </div>

            <CardBrandLogo brand={card.brand} className={theme.textColor} />
          </div>
        </div>
      </div>
    </div>
  );
}
