"use client";

import React from "react";

export interface WalletPlusLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "auto";
  showSymbol?: boolean;
  glow?: boolean;
  className?: string;
}

const SIZES = {
  xs: {
    text: "text-[11px]",
    plus: "text-[12px]",
    symbol: "w-2.5 h-2.5",
    gap: "gap-1",
  },
  sm: {
    text: "text-[13px]",
    plus: "text-[14px]",
    symbol: "w-3 h-3",
    gap: "gap-1.5",
  },
  md: {
    text: "text-base sm:text-lg",
    plus: "text-lg sm:text-xl",
    symbol: "w-4 h-4",
    gap: "gap-2",
  },
  lg: {
    text: "text-xl sm:text-2xl",
    plus: "text-2xl sm:text-3xl",
    symbol: "w-5 h-5",
    gap: "gap-2.5",
  },
  xl: {
    text: "text-3xl sm:text-4xl",
    plus: "text-4xl sm:text-5xl",
    symbol: "w-7 h-7",
    gap: "gap-3",
  },
};

/**
 * Componente oficial de identidade "Wallet+" inspirado no branding de serviços da Apple (Apple tv+, Apple Card, Apple Fitness+).
 * Tipografia San Francisco, acabamento monocromático minimalista, com o símbolo "+" iluminado.
 */
export function WalletPlusLogo({
  size = "md",
  theme = "dark",
  showSymbol = false,
  glow = true,
  className = "",
}: WalletPlusLogoProps) {
  const currentSize = SIZES[size] || SIZES.md;
  const isDark = theme === "dark";

  return (
    <div
      className={`inline-flex items-center select-none tracking-tight font-semibold ${currentSize.gap} ${className}`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      }}
    >
      {showSymbol && (
        <span
          className={`shrink-0 rounded-full flex items-center justify-center ${
            isDark ? "text-white" : "text-[#1D1D1F]"
          }`}
          aria-hidden="true"
        >
          {/* Símbolo minimalista Apple estilo card/wallet */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={currentSize.symbol}
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" x2="22" y1="10" y2="10" />
          </svg>
        </span>
      )}

      <span
        className={`font-semibold tracking-[-0.03em] ${currentSize.text} ${
          isDark ? "text-white" : "text-[#1D1D1F]"
        }`}
      >
        Wallet
      </span>

      {/* Símbolo '+' com iluminação inspirada diretamente na Apple tv+ */}
      <span
        className={`font-bold tracking-tight inline-block leading-none ${currentSize.plus} ${
          isDark
            ? glow
              ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
              : "text-white"
            : "text-[#1D1D1F]"
        }`}
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
        }}
      >
        +
      </span>
    </div>
  );
}

/**
 * Capsule / Pill minimalista do Wallet+ para barras de navegação ou headers
 */
export function WalletPlusCapsule({
  active = false,
  size = "sm",
  className = "",
}: {
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center transition-all duration-200 select-none ${
        size === "sm"
          ? "px-3 py-1.5 rounded-full"
          : "px-4 py-2 rounded-full"
      } ${
        active
          ? "bg-[#000000] text-white shadow-md shadow-black/25 ring-1 ring-white/20 scale-[1.02]"
          : "bg-[#1D1D1F] text-white hover:bg-black shadow-xs hover:scale-[1.02]"
      } border border-white/10 ${className}`}
    >
      <WalletPlusLogo size={size === "sm" ? "xs" : "sm"} theme="dark" glow />
    </div>
  );
}
