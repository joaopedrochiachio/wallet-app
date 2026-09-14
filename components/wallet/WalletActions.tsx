"use client";

import React from "react";
import { Plus, CreditCard } from "lucide-react";
import { WPayLogo } from "@/components/ui/WPayLogo";

interface WalletActionsProps {
  onPayWithWPay?: () => void;
  onAddNewCard?: () => void;
}

export function WalletActions({
  onPayWithWPay,
  onAddNewCard,
}: WalletActionsProps) {
  return (
    <div className="flex items-center justify-center sm:justify-end gap-2.5 flex-wrap max-w-4xl mx-auto font-sans">
      {/* Adicionar Cartão */}
      {onAddNewCard && (
        <button
          type="button"
          onClick={onAddNewCard}
          className="h-9 px-3.5 bg-black/[0.04] hover:bg-black/[0.07] text-[#1D1D1F] border border-black/[0.06] rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus size={14} strokeWidth={2} className="text-[#86868B]" />
          <span>Novo Cartão</span>
        </button>
      )}

      {/* Botão Principal W Pay */}
      {onPayWithWPay && (
        <button
          type="button"
          onClick={onPayWithWPay}
          className="h-9 px-4 bg-[#1D1D1F] hover:bg-black text-white rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <WPayLogo size="sm" variant="light" />
          <span>Pagar Lançamento</span>
        </button>
      )}
    </div>
  );
}
