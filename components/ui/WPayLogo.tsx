"use client";

import React from "react";

interface WPayLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "dark" | "light" | "outline";
  className?: string;
}

/**
 * Logotipo estilizado no padrão oficial Apple Pay (trocando a maçã pelo W de Wallet)
 * Respeita a tipografia, proporções e estilo de design Apple Human Interface Guidelines.
 */
export function WPayLogo({ size = "md", variant = "dark", className = "" }: WPayLogoProps) {
  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-base gap-1.5",
    lg: "text-xl gap-2",
    xl: "text-2xl gap-2.5",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5 text-[9px]",
    md: "w-4.5 h-4.5 text-[11px]",
    lg: "w-6 h-6 text-[14px]",
    xl: "w-7 h-7 text-[16px]",
  };

  const isDark = variant === "dark";

  return (
    <div
      className={`inline-flex items-center font-sans tracking-tight select-none ${sizeClasses[size]} ${className}`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}
    >
      {/* Glifo W no formato Apple */}
      <span
        className={`inline-flex items-center justify-center font-black rounded-[4px] leading-none transition-transform ${iconSizes[size]} ${
          isDark
            ? "bg-[#1D1D1F] text-white"
            : variant === "outline"
            ? "border border-current text-current font-extrabold"
            : "bg-white text-[#1D1D1F]"
        }`}
      >
        W
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
