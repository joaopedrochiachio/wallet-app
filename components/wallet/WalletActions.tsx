"use client";

import React from "react";
import { Plus, CreditCard, ArrowUpRight, CheckCircle2, Ticket } from "lucide-react";
import { WPayLogo } from "@/components/ui/WPayLogo";

interface WalletActionsProps {
  onPayWithWPay?: () => void;
  onAddNewCard?: () => void;
  onPayInvoice?: () => void;
  onAddNewPass?: () => void;
  hasOpenInvoice?: boolean;
}

export function WalletActions({
  onPayWithWPay,
  onAddNewCard,
  onPayInvoice,
  onAddNewPass,
  hasOpenInvoice = false,
}: WalletActionsProps) {
  return (
    <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap max-w-4xl mx-auto font-sans">
      {/* Botão Principal W Pay */}
      {onPayWithWPay && (
        <button
          type="button"
          onClick={onPayWithWPay}
          className="flex-1 min-w-[140px] max-w-[200px] h-12 bg-[#1D1D1F] hover:bg-black text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <WPayLogo size="sm" />
          <span>Pagar</span>
        </button>
      )}

      {/* Pagar Fatura se houver */}
      {onPayInvoice && hasOpenInvoice && (
        <button
          type="button"
          onClick={onPayInvoice}
          className="flex-1 min-w-[140px] max-w-[200px] h-12 bg-white hover:bg-gray-50 text-[#1D1D1F] border border-black/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Pagar Fatura</span>
        </button>
      )}

      {/* Adicionar Cartão */}
      {onAddNewCard && (
        <button
          type="button"
          onClick={onAddNewCard}
          className="h-12 px-4 bg-white hover:bg-gray-50 text-[#1D1D1F] border border-black/10 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus size={14} />
          <CreditCard size={15} />
          <span className="hidden sm:inline">Novo Cartão</span>
        </button>
      )}

      {/* Adicionar Passe / Ingresso */}
      {onAddNewPass && (
        <button
          type="button"
          onClick={onAddNewPass}
          className="h-12 px-4 bg-white hover:bg-gray-50 text-[#1D1D1F] border border-black/10 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-semibold shadow-2xs hover:shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus size={14} />
          <Ticket size={15} />
          <span className="hidden sm:inline">Adicionar Passe</span>
        </button>
      )}
    </div>
  );
}
