"use client";

import React from "react";
import { WalletCardData } from "@/types/wallet";
import { CardEMVChip, CardContactlessIcon } from "./CardEMVChip";
import { CardBrandLogo } from "./CardBrandLogo";

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
  const isApple = card.brand === "apple";
  const isLight = isApple || card.background?.includes("from-[#E5E5EA]");

  const textColor = isLight ? "text-[#1D1D1F]" : "text-white";
  const mutedColor = isLight ? "text-[#86868B]" : "text-white/70";
  const subtleBorder = isLight ? "border-black/10" : "border-white/20";

  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] aspect-[1.586/1] rounded-[26px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl border ${subtleBorder} ${
        interactive ? "cursor-pointer transition-transform duration-300 active:scale-[0.98]" : ""
      } ${className}`}
      style={{
        background: card.background
          ? undefined
          : "linear-gradient(135deg, #1C1C1E 0%, #141416 50%, #0A0A0C 100%)",
      }}
    >
      {/* Background Gradient class if supplied */}
      {card.background && (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${card.background} -z-10`}
        />
      )}

      {/* Specular light highlight on top-left edge */}
      <div className="absolute -top-24 -left-24 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 pointer-events-none rounded-[26px]" />

      {/* HEADER: Title & Contactless */}
      <div className="flex items-center justify-between relative z-10">
        <div>
          <h3 className={`text-sm font-semibold tracking-tight ${textColor}`}>
            {card.title}
          </h3>
          {card.subtitle && (
            <p className={`text-[11px] font-medium tracking-wide ${mutedColor}`}>
              {card.subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CardContactlessIcon className={mutedColor} />
        </div>
      </div>

      {/* MIDDLE: EMV Chip */}
      <div className="relative z-10 flex items-center justify-between my-auto">
        <CardEMVChip color={isLight ? "silver" : "gold"} />
        {card.balance !== undefined && card.balance > 0 && (
          <div className="text-right">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${mutedColor}`}>
              Saldo
            </span>
            <div className={`text-base font-semibold tracking-tight ${textColor}`}>
              R$ {card.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER: Number, Holder, Expiry, Brand Logo */}
      <div className="relative z-10 space-y-2">
        {/* Card Number */}
        <div className={`font-mono text-sm tracking-[0.2em] font-medium ${textColor}`}>
          {card.cardNumber || "•••• •••• •••• 4892"}
        </div>

        <div className="flex items-end justify-between pt-1">
          <div className="space-y-0.5">
            <span className={`text-[9px] uppercase tracking-widest font-semibold block ${mutedColor}`}>
              TITULAR
            </span>
            <span className={`text-xs font-semibold uppercase tracking-wider block ${textColor}`}>
              {card.holderName || "NOME DO CLIENTE"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="space-y-0.5 text-right">
              <span className={`text-[9px] uppercase tracking-widest font-semibold block ${mutedColor}`}>
                VALIDADE
              </span>
              <span className={`text-xs font-mono font-medium block ${textColor}`}>
                {card.expirationDate || "12/29"}
              </span>
            </div>

            <CardBrandLogo brand={card.brand} className={isLight ? "text-[#1D1D1F]" : "text-white"} />
          </div>
        </div>
      </div>
    </div>
  );
}
