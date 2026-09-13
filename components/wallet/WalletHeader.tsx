"use client";

import React from "react";
import { Plus, CreditCard, Layers } from "lucide-react";

interface WalletHeaderProps {
  activeTab: "all" | "cards" | "passes";
  onTabChange: (tab: "all" | "cards" | "passes") => void;
  onOpenNewTransaction?: () => void;
  cardsCount: number;
  passesCount: number;
}

export function WalletHeader({
  activeTab,
  onTabChange,
  onOpenNewTransaction,
  cardsCount,
  passesCount,
}: WalletHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-4xl mx-auto font-sans">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Apple Wallet & 3D Cards
          </span>
          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white">
            W Pay
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
          Carteira
        </h1>
      </div>

      {/* Segmented Control & Actions */}
      <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
        {/* Apple Segmented Control */}
        <div className="bg-[#E5E5EA]/80 p-1 rounded-full flex items-center gap-1 border border-black/5">
          <button
            type="button"
            onClick={() => onTabChange("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Visão Geral
          </button>
          <button
            type="button"
            onClick={() => onTabChange("cards")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "cards"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <CreditCard size={13} />
            <span>Cartões 3D ({cardsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange("passes")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "passes"
                ? "bg-white text-[#1D1D1F] shadow-xs"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            <Layers size={13} />
            <span>Passes ({passesCount})</span>
          </button>
        </div>

        {onOpenNewTransaction && (
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="w-9 h-9 rounded-full bg-[#1D1D1F] text-white hover:bg-black active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
            title="Adicionar Lançamento"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
