"use client";

import React from "react";
import { Plus } from "lucide-react";
import { WalletLogo } from "@/components/ui/WalletLogo";
import { WPayLogo } from "@/components/ui/WPayLogo";

interface WalletHeaderProps {
  onOpenNewTransaction?: () => void;
  onAddNewCard?: () => void;
  cardsCount: number;
}

export function WalletHeader({
  onOpenNewTransaction,
  onAddNewCard,
  cardsCount,
}: WalletHeaderProps) {
  return (
    <header className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 font-sans select-none">
      {/* Identidade e Título */}
      <div className="flex items-center gap-3.5">
        <WalletLogo
          size="lg"
          variant="icon"
          priority
          className="shadow-2xs shrink-0"
        />
        <div>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
          >
            Carteira
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#86868B] font-normal mt-0.5">
            <span>
              {cardsCount} {cardsCount === 1 ? "cartão ativo" : "cartões ativos"}
            </span>
            <span className="text-[#C7C7CC]">·</span>
            <span>Experiência Apple Wallet</span>
          </div>
        </div>
      </div>

      {/* Ações Rápidas Integradas no Cabeçalho */}
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {onAddNewCard && (
          <button
            type="button"
            onClick={onAddNewCard}
            className="h-9 px-3.5 rounded-full bg-black/[0.04] hover:bg-black/[0.07] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold border border-black/[0.06] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Cadastrar novo cartão"
          >
            <Plus size={14} strokeWidth={2} className="text-[#86868B]" />
            <span>Novo Cartão</span>
          </button>
        )}

        {onOpenNewTransaction && (
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="h-9 px-4 rounded-full bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs font-semibold shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Registrar pagamento ou lançamento"
          >
            <WPayLogo size="sm" variant="light" />
            <span>Pagar Lançamento</span>
          </button>
        )}
      </div>
    </header>
  );
}

