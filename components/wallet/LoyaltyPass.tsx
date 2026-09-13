"use client";

import React from "react";
import { LoyaltyPassData } from "@/types/wallet";
import { Sparkles, Crown } from "lucide-react";

interface LoyaltyPassProps {
  data: LoyaltyPassData;
  className?: string;
  onClick?: () => void;
  isExpanded?: boolean;
}

export function LoyaltyPass({
  data,
  className = "",
  onClick,
  isExpanded = true,
}: LoyaltyPassProps) {
  return (
    <div
      onClick={onClick}
      className={`relative w-full max-w-[390px] rounded-[24px] overflow-hidden shadow-xl border border-white/15 text-white font-sans select-none transition-all duration-300 ${
        onClick ? "cursor-pointer hover:shadow-2xl active:scale-[0.99]" : ""
      } ${className}`}
      style={{
        background: "linear-gradient(145deg, #240C38 0%, #13051F 100%)",
      }}
    >
      {/* Background theme gradient */}
      {data.themeColor && (
        <div className={`absolute inset-0 bg-gradient-to-br ${data.themeColor} -z-10`} />
      )}

      {/* Light sheen */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-300/40 to-transparent pointer-events-none" />

      {/* HEADER: Program name & Tier */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <Crown size={14} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white block leading-none">
              {data.programName}
            </span>
            <span className="text-[10px] text-purple-300/70 font-medium">
              {data.category}
            </span>
          </div>
        </div>

        <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-200 bg-purple-500/20 border border-purple-400/30 px-2.5 py-0.5 rounded-full">
          {data.tier}
        </span>
      </div>

      {/* PRIMARY FIELD: Points Balance */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-purple-300/60 block">
            SALDO DISPONÍVEL
          </span>
          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
            <Sparkles size={11} /> +5% Cashback
          </span>
        </div>
        <div className="text-3xl font-black tracking-tight text-white mt-0.5">
          {data.pointsBalance}
        </div>
      </div>

      {/* SECONDARY FIELDS */}
      <div className="px-5 py-3 grid grid-cols-2 gap-2 border-t border-white/10 bg-black/20">
        <div className="space-y-0.5">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
            TITULAR
          </span>
          <span className="text-xs font-semibold text-white block uppercase truncate">
            {data.holderName}
          </span>
        </div>

        <div className="space-y-0.5 text-right">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-white/50 block">
            Nº DE MEMBRO
          </span>
          <span className="text-xs font-mono font-semibold text-purple-200 block truncate">
            {data.memberId}
          </span>
        </div>
      </div>

      {/* PERFORATED NOTCHES */}
      {isExpanded && (
        <div className="relative py-2 flex items-center justify-between overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -ml-2.5 shadow-inner border-r border-black/10" />
          <div className="flex-1 border-b-2 border-dashed border-white/20 mx-2" />
          <div className="w-5 h-5 rounded-full bg-[#F2F2F7] -mr-2.5 shadow-inner border-l border-black/10" />
        </div>
      )}

      {/* BARCODE */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 flex flex-col items-center justify-center gap-2">
          <div className="w-full max-w-[260px] bg-white rounded-xl p-3 flex flex-col items-center justify-center shadow-xs">
            <div className="w-full flex justify-between items-center h-10 px-1 overflow-hidden opacity-95">
              {Array.from({ length: 44 }).map((_, i) => (
                <div
                  key={i}
                  className="h-full bg-[#1F0A2E]"
                  style={{
                    width: i % 3 === 0 ? "3px" : i % 5 === 0 ? "4px" : "1.5px",
                    marginRight: i % 4 === 0 ? "2px" : "1px",
                  }}
                />
              ))}
            </div>
          </div>

          <span className="font-mono text-[10px] tracking-widest text-white/60">
            {data.barcodeNumber || "9102 4819 0281 7731"}
          </span>
        </div>
      )}
    </div>
  );
}
