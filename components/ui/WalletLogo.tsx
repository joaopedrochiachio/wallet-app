"use client";

import React from "react";
import Image from "next/image";

export interface WalletLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "hero" | number;
  variant?: "icon" | "banner" | "full";
  withText?: boolean;
  textSubtitle?: string;
  className?: string;
  priority?: boolean;
}

const SIZE_MAP: Record<string, { px: number; rounded: string }> = {
  xs: { px: 18, rounded: "rounded-[5px]" },
  sm: { px: 24, rounded: "rounded-lg" },
  md: { px: 32, rounded: "rounded-xl" },
  lg: { px: 40, rounded: "rounded-2xl" },
  xl: { px: 48, rounded: "rounded-2xl" },
  "2xl": { px: 64, rounded: "rounded-[22px]" },
  hero: { px: 88, rounded: "rounded-[28px]" },
};

export function WalletLogo({
  size = "md",
  variant = "icon",
  withText = false,
  textSubtitle,
  className = "",
  priority = false,
}: WalletLogoProps) {
  const pixelSize = typeof size === "number" ? size : (SIZE_MAP[size]?.px ?? 32);
  const roundedClass = typeof size === "number" ? "rounded-xl" : (SIZE_MAP[size]?.rounded ?? "rounded-xl");

  if (variant === "banner") {
    return (
      <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
        <Image
          src="/logo.png"
          alt="Wallet Logo"
          width={pixelSize}
          height={pixelSize}
          className={`${roundedClass} object-contain shadow-xs`}
          priority={priority}
        />
      </div>
    );
  }

  const iconElement = (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${roundedClass} shadow-2xs ${
        variant === "icon" && !withText ? className : ""
      }`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <Image
        src="/logo2.png"
        alt="Wallet Logo"
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full object-contain"
        priority={priority}
      />
    </div>
  );

  if (variant === "full" || withText) {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        {iconElement}
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
              Wallet
            </span>
            {textSubtitle && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white font-mono">
                {textSubtitle}
              </span>
            )}
          </div>
          {!textSubtitle && (
            <span className="text-[10px] text-[#86868B] font-mono tracking-wider uppercase mt-0.5">
              Intelligence
            </span>
          )}
        </div>
      </div>
    );
  }

  return iconElement;
}
