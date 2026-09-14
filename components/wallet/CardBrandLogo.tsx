"use client";

import React from "react";
import { CardBrand } from "@/types/wallet";

import Image from "next/image";

interface CardBrandLogoProps {
  brand?: CardBrand | string;
  className?: string;
}

export function CardBrandLogo({ brand = "mastercard", className = "" }: CardBrandLogoProps) {
  const normalized = (brand || "").toLowerCase();

  if (normalized.includes("wallet") || normalized === "w" || normalized.includes("wpay")) {
    return (
      <div className={`flex items-center gap-1.5 select-none ${className}`}>
        <Image
          src="/brand/wallet-symbol.png"
          alt="Wallet"
          width={22}
          height={16}
          className="object-contain shrink-0"
        />
        <span className="text-xs font-semibold tracking-tight font-sans">Wallet</span>
      </div>
    );
  }

  if (normalized.includes("apple")) {
    return (
      <div className={`flex items-center gap-1 text-inherit ${className}`}>
        <svg width="18" height="22" viewBox="0 0 170 170" fill="currentColor">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.66-7.79-11.88-14.24-5.23-7.93-9.51-17.18-12.83-27.75-3.33-10.57-5-20.93-5-31.09 0-14.24 3.73-26.04 11.2-35.41 7.46-9.37 16.79-14.16 27.97-14.37 5.35 0 11.02 1.34 17.02 4.02 6 2.68 10.05 4.07 12.15 4.17 1.83 0 6.07-1.46 12.73-4.39 6.66-2.92 12.43-4.14 17.3-3.65 13.27 1.25 23.49 6.22 30.64 14.92-11.66 7.07-17.37 16.73-17.14 28.98.24 9.54 3.86 17.51 10.87 23.91 7.01 6.4 15.34 10.01 24.99 10.83-2.18 6.53-4.78 13.06-7.81 19.59zM119.22 33.58c0-7.39 2.66-14.42 7.98-21.1 5.32-6.68 11.95-11.23 19.89-13.66.69 3.53.69 7.08 0 10.65-.7 3.57-2.13 7.15-4.29 10.74-2.58 4.29-5.83 7.82-9.74 10.6-3.92 2.78-8.21 4.41-12.88 4.88-.24-.71-.53-1.42-.87-2.11h-.09z"/>
        </svg>
        <span className="text-xs font-semibold tracking-tight font-sans">Card</span>
      </div>
    );
  }

  if (normalized.includes("visa")) {
    return (
      <div className={`font-black tracking-wider italic text-sm select-none ${className}`}>
        VISA
      </div>
    );
  }

  if (normalized.includes("elo")) {
    return (
      <div className={`flex items-center gap-0.5 select-none ${className}`}>
        <div className="w-2.5 h-2.5 rounded-full bg-[#E52525]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#F3C300] -ml-1" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#00A4E4] -ml-1" />
        <span className="text-xs font-bold ml-1 font-sans">elo</span>
      </div>
    );
  }

  if (normalized.includes("amex") || normalized.includes("american")) {
    return (
      <div className={`border border-current px-1.5 py-0.5 rounded text-[10px] font-black tracking-widest uppercase select-none ${className}`}>
        AMEX
      </div>
    );
  }

  // Default: Mastercard
  return (
    <div className={`flex items-center select-none ${className}`} aria-label="Mastercard">
      <div className="w-6 h-6 rounded-full bg-[#EB001B] opacity-90" />
      <div className="w-6 h-6 rounded-full bg-[#F79E1B] opacity-90 -ml-3 mix-blend-screen" />
    </div>
  );
}
