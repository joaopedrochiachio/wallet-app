"use client";

import React from "react";
import { CardItem } from "@/types";

interface MiniCardProps {
  cardName?: string;
  brand?: string;
  colorScheme?: CardItem["colorScheme"];
  className?: string;
}

export function MiniCard({
  cardName = "",
  brand = "",
  colorScheme,
  className = "",
}: MiniCardProps) {
  const normalizedName = cardName.trim().toLowerCase();
  const normalizedBrand = brand.trim().toLowerCase();

  // Gradiente estilizado por banco ou do preset cadastrado
  let gradientClass = "";

  if (normalizedName.includes("nubank") || normalizedName.includes("nu")) {
    gradientClass = "bg-gradient-to-br from-[#820AD1] via-[#5C0382] to-[#36004D]";
  } else if (normalizedName.includes("santander")) {
    gradientClass = "bg-gradient-to-br from-[#EC0000] via-[#C00000] to-[#800000]";
  } else if (normalizedName.includes("inter")) {
    gradientClass = "bg-gradient-to-br from-[#FF7A00] via-[#EB5E00] to-[#B33C00]";
  } else if (normalizedName.includes("itau") || normalizedName.includes("itaú")) {
    gradientClass = "bg-gradient-to-br from-[#EC7000] via-[#003399] to-[#001A4D]";
  } else if (normalizedName.includes("bradesco")) {
    gradientClass = "bg-gradient-to-br from-[#CC092F] via-[#9E0624] to-[#600215]";
  } else if (normalizedName.includes("c6")) {
    gradientClass = "bg-gradient-to-br from-[#2E2E2E] via-[#1A1A1A] to-[#0A0A0A]";
  } else if (colorScheme?.gradient) {
    gradientClass = `bg-gradient-to-br ${colorScheme.gradient}`;
  } else {
    gradientClass = "bg-gradient-to-br from-[#2C2C2E] via-[#1C1C1E] to-[#0A0A0C]";
  }

  // Identificação da bandeira
  const isVisa = normalizedBrand.includes("visa") || normalizedName.includes("visa");
  const isElo = normalizedBrand.includes("elo") || normalizedName.includes("elo");

  return (
    <div
      className={`relative w-12 h-7.5 rounded-[6px] p-1 flex flex-col justify-between overflow-hidden shadow-xs border border-white/20 select-none shrink-0 ${gradientClass} ${className}`}
      title={cardName}
      data-testid="mini-card-visual"
    >
      {/* Brilho diagonal Apple Glass */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/15 to-transparent pointer-events-none" />

      {/* Topo do Cartão: Micro Chip EMV Metálico + Contactless Waves */}
      <div className="flex items-center justify-between relative z-10">
        {/* Chip Metálico */}
        <div className="w-2.5 h-1.5 rounded-[1.5px] bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 border border-amber-600/40 shadow-[0_0.5px_1px_rgba(0,0,0,0.25)] flex items-center justify-center">
          <div className="w-1 h-0.5 border-t border-b border-amber-700/30" />
        </div>

        {/* Linhas de aproximação / Contactless */}
        <div className="flex items-center gap-[1px] opacity-75">
          <div className="w-[1px] h-1 rounded-full bg-white/60" />
          <div className="w-[1px] h-1.5 rounded-full bg-white/80" />
          <div className="w-[1px] h-2 rounded-full bg-white" />
        </div>
      </div>

      {/* Base do Cartão: Micro dígitos e Bandeira */}
      <div className="flex items-end justify-between relative z-10 leading-none">
        <span className="text-[6px] tracking-widest text-white/70 font-mono">
          ••••
        </span>

        {/* Bandeira */}
        {isVisa ? (
          <span className="text-[6.5px] font-black italic text-white tracking-tighter">
            VISA
          </span>
        ) : isElo ? (
          <div className="flex items-center gap-[1px]">
            <div className="w-1 h-1 rounded-full bg-[#E52525]" />
            <div className="w-1 h-1 rounded-full bg-[#F3C300] -ml-0.5" />
            <div className="w-1 h-1 rounded-full bg-[#00A4E4] -ml-0.5" />
          </div>
        ) : (
          /* Mastercard padrão: círculos sobrepostos */
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-[#EB001B] opacity-95 shadow-2xs" />
            <div className="w-2 h-2 rounded-full bg-[#F79E1B] -ml-1 opacity-95 shadow-2xs" />
          </div>
        )}
      </div>
    </div>
  );
}
