"use client";

import React from "react";

import Image from "next/image";

interface WPayLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "dark" | "light" | "outline";
  className?: string;
}

/**
 * Logotipo estilizado no padrão oficial Apple Pay (trocando a maçã pelo W oficial de Wallet)
 * Respeita a tipografia, proporções e estilo de design Apple Human Interface Guidelines.
 */
export function WPayLogo({ size = "md", variant = "dark", className = "" }: WPayLogoProps) {
  const sizeClasses = {
    sm: "text-xs gap-1.5",
    md: "text-base gap-2",
    lg: "text-xl gap-2.5",
    xl: "text-2xl gap-3",
  };

  const iconDims: Record<string, { size: number; boxClass: string; rounded: string }> = {
    sm: { size: 16, boxClass: "w-4 h-4", rounded: "rounded-[4px]" },
    md: { size: 20, boxClass: "w-5 h-5", rounded: "rounded-[5px]" },
    lg: { size: 26, boxClass: "w-6.5 h-6.5", rounded: "rounded-[6px]" },
    xl: { size: 32, boxClass: "w-8 h-8", rounded: "rounded-[8px]" },
  };

  const currentDim = iconDims[size] || iconDims.md;
  const isDark = variant === "dark";

  return (
    <div
      className={`inline-flex items-center font-sans tracking-tight select-none ${sizeClasses[size]} ${className}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}
    >
      {/* Glifo com a logo oficial Wallet */}
      <span
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden leading-none transition-transform shadow-2xs ${currentDim.boxClass} ${currentDim.rounded} ${
          variant === "outline" ? "border border-current" : ""
        }`}
      >
        <Image
          src="/brand/wallet-symbol-trans.png"
          alt="Wallet Pay Logo"
          width={currentDim.size}
          height={Math.round(currentDim.size * 0.74)}
          className="w-full h-full object-contain"
        />
      </span>
      <span className={`font-semibold tracking-[-0.03em] ${isDark ? "text-[#1D1D1F]" : "text-white"}`}>
        Pay
      </span>
    </div>
  );
}

interface WPayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string; // ex: "Pagar com W Pay", "Receber com W Pay", ou apenas "W Pay"
  theme?: "black" | "white" | "white-outline";
  isLoading?: boolean;
}

/**
 * Botão Oficial Padrão Apple Pay (Smart Animate Apple Pay Interaction)
 */
export function WPayButton({
  label,
  theme = "black",
  isLoading = false,
  className = "",
  disabled,
  children,
  ...props
}: WPayButtonProps) {
  const baseClasses =
    "w-full h-12 sm:h-13 rounded-2xl flex items-center justify-center gap-2 font-medium text-base transition-all duration-150 active:scale-[0.98] select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs";

  const themeClasses = {
    black: "bg-black text-white hover:bg-[#1C1C1E] border border-black",
    white: "bg-white text-black hover:bg-gray-50 border border-black/10 shadow-xs",
    "white-outline": "bg-white text-black hover:bg-gray-50 border-2 border-black",
  };

  return (
    <button
      type="button"
      disabled={disabled || isLoading}
      className={`${baseClasses} ${themeClasses[theme]} ${className}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
      {...props}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Processando...</span>
        </div>
      ) : children ? (
        children
      ) : (
        <div className="flex items-center gap-1.5">
          {label && <span className="text-sm font-normal tracking-tight mr-1">{label}</span>}
          <WPayLogo
            size="md"
            variant={theme === "black" ? "light" : "dark"}
          />
        </div>
      )}
    </button>
  );
}
