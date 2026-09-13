"use client";

import React from "react";
import { Plus } from "lucide-react";
import { WPayLogo } from "@/components/ui/WPayLogo";

interface WalletHeaderProps {
  onOpenNewTransaction?: () => void;
  cardsCount: number;
}

export function WalletHeader({
  onOpenNewTransaction,
  cardsCount,
}: WalletHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto font-sans">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider uppercase text-[#86868B]">
            Experiência Apple Wallet
          </span>
          <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full bg-[#1D1D1F] text-white">
            W Pay
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1D1D1F] mt-0.5">
          Carteira
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="hidden sm:inline-flex text-xs font-semibold text-[#86868B] px-3 py-1.5 rounded-full bg-white border border-black/5">
          {cardsCount} {cardsCount === 1 ? "cartão ativo" : "cartões ativos"}
        </span>

        {onOpenNewTransaction && (
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="w-10 h-10 rounded-full bg-[#1D1D1F] text-white hover:bg-black active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
            title="Novo Lançamento"
          >
            <Plus size={18} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
