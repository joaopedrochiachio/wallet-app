"use client";

import React from "react";

interface CardEMVChipProps {
  color?: "gold" | "silver";
  className?: string;
}

export function CardEMVChip({ color = "gold", className = "" }: CardEMVChipProps) {
  const isGold = color === "gold";

  return (
    <div
      className={`relative w-11 h-8 rounded-md overflow-hidden shadow-inner border flex items-center justify-center shrink-0 select-none ${
        isGold
          ? "bg-gradient-to-br from-[#E6C778] via-[#F4E09E] to-[#BFA153] border-[#C8A95A]"
          : "bg-gradient-to-br from-[#E2E8F0] via-[#F8FAFC] to-[#CBD5E1] border-[#94A3B8]"
      } ${className}`}
      aria-hidden="true"
    >
      {/* Circuit lines */}
      <div className="absolute inset-0.5 border border-black/15 rounded-[3px] pointer-events-none" />
      <div className="w-full h-[1px] bg-black/20 my-auto" />
      <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-black/20" />
      <div className="absolute top-0 bottom-0 right-1/3 w-[1px] bg-black/20" />
      <div className="w-3.5 h-3 rounded-sm border border-black/20 bg-black/5" />
    </div>
  );
}

export function CardContactlessIcon({ className = "text-white/70" }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label="Contactless"
    >
      <path d="M7 16a6 6 0 0 1 0-8" />
      <path d="M11 19a10 10 0 0 0 0-14" />
      <path d="M15 22a14 14 0 0 0 0-20" />
    </svg>
  );
}
