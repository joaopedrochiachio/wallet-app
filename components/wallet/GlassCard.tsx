"use client";

import React from "react";
import { WalletCardData } from "@/types/wallet";
import { CardEMVChip, CardContactlessIcon } from "./CardEMVChip";
import { CardBrandLogo } from "./CardBrandLogo";

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
  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] aspect-[1.586/1] rounded-[28px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-white/30 backdrop-blur-xl bg-white/10 ${
        interactive ? "cursor-pointer transition-all duration-300 active:scale-[0.98]" : ""
      } ${className}`}
      style={{
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 60%, rgba(255, 255, 255, 0.12) 100%)",
      }}
    >
      {/* Underlying deep gradient backing for contrast */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${
          card.background || "from-[#1A0B2E]/70 via-[#11051F]/80 to-[#0A0214]/90"
        } -z-20`}
      />

      {/* Internal Glass Reflection Sheen (diagonal light refraction) */}
      <div
        className="absolute -top-32 -left-32 w-80 h-80 bg-white/20 rounded-full blur-3xl pointer-events-none -z-10"
      />
      <div
        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/25 pointer-events-none rounded-[28px] -z-10"
      />
      {/* Specular edge shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/60 to-transparent pointer-events-none" />

      {/* HEADER: Title & Contactless */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-white drop-shadow-xs">
              {card.title}
            </h3>
            {card.subtitle && (
              <p className="text-[10px] font-medium tracking-wider text-white/70 uppercase">
                {card.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
            Glass
          </span>
          <CardContactlessIcon className="text-white/80" />
        </div>
      </div>

      {/* MIDDLE: EMV Chip & Limit/Balance */}
      <div className="relative z-10 flex items-center justify-between my-auto">
        <CardEMVChip color="silver" />

        {card.limit !== undefined && (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-white/60 block">
              Limite Disponível
            </span>
            <div className="text-sm font-semibold tracking-tight text-white drop-shadow-xs">
              R$ {((card.limit || 0) - (card.spent || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Number, Holder, Expiry, Brand */}
      <div className="relative z-10 space-y-2">
        <div className="font-mono text-sm tracking-[0.22em] font-medium text-white drop-shadow-xs">
          {card.cardNumber || "•••• •••• •••• 8842"}
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-widest font-semibold block text-white/60">
              TITULAR
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider block text-white drop-shadow-xs">
              {card.holderName || "NOME DO CLIENTE"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-0.5 text-right">
              <span className="text-[9px] uppercase tracking-widest font-semibold block text-white/60">
                VALIDADE
              </span>
              <span className="text-xs font-mono font-medium block text-white drop-shadow-xs">
                {card.expirationDate || "09/31"}
              </span>
            </div>

            <CardBrandLogo brand={card.brand} className="text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}
