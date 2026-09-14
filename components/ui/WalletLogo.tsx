"use client";

import React from "react";
import Image from "next/image";

export interface WalletLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "hero" | number;
  variant?: "icon" | "symbol" | "lockup" | "full" | "banner";
  withText?: boolean;
  textSubtitle?: string;
  className?: string;
  priority?: boolean;
}

const SIZE_MAP: Record<string, { px: number; textClass: string; subClass: string }> = {
  xs: { px: 20, textClass: "text-xs font-semibold", subClass: "text-[9px]" },
  sm: { px: 28, textClass: "text-sm font-semibold", subClass: "text-[10px]" },
  md: { px: 36, textClass: "text-base font-semibold", subClass: "text-[10px]" },
  lg: { px: 44, textClass: "text-lg font-semibold", subClass: "text-[11px]" },
  xl: { px: 56, textClass: "text-xl font-semibold", subClass: "text-xs" },
  "2xl": { px: 72, textClass: "text-2xl font-bold", subClass: "text-xs" },
  hero: { px: 96, textClass: "text-3xl font-bold", subClass: "text-sm" },
};

export function WalletLogo({
  size = "md",
  variant = "icon",
  withText = false,
  textSubtitle,
  className = "",
  priority = false,
}: WalletLogoProps) {
  const sizeConfig = typeof size === "number" ? null : SIZE_MAP[size];
  const pixelSize = typeof size === "number" ? size : (sizeConfig?.px ?? 36);

  // Modo Símbolo isolado (recorte puro da fita 3D W com o chip do cartão)
  if (variant === "symbol") {
    return (
      <div
        className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
        style={{ width: pixelSize, height: Math.round(pixelSize * 0.74) }}
      >
        <Image
          src="/brand/wallet-symbol.png"
          alt="Wallet Symbol"
          width={pixelSize}
          height={Math.round(pixelSize * 0.74)}
          className="w-full h-full object-contain"
          priority={priority}
        />
      </div>
    );
  }

  // Ícone Squircle Apple (Ícone oficial do app sem textos baked-in e sem bordas vazias)
  const iconElement = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden rounded-[22%] ${
        variant === "icon" && !withText ? className : ""
      }`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <Image
        src="/brand/wallet-icon.png"
        alt="Wallet Logo"
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full object-contain transition-transform duration-200"
        priority={priority}
      />
    </div>
  );

  // Lockup de Marca completo (Ícone + Tipografia nativa Apple "Wallet Intelligence")
  if (variant === "lockup" || variant === "full" || withText) {
    const textClass = sizeConfig?.textClass ?? "text-base font-semibold";
    const subClass = sizeConfig?.subClass ?? "text-[10px]";

    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        {iconElement}
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={`tracking-tight text-[#1D1D1F] ${textClass}`}
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
            >
              Wallet
            </span>
            {textSubtitle && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white font-mono">
                {textSubtitle}
              </span>
            )}
          </div>
          {!textSubtitle && (
            <span className={`text-[#86868B] font-mono tracking-wider uppercase ${subClass}`}>
              Intelligence
            </span>
          )}
        </div>
      </div>
    );
  }

  return iconElement;
}

