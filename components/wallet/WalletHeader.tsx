"use client";

import React from "react";
import { Plus, FileText, Calculator, CreditCard } from "lucide-react";
import { WalletLogo } from "@/components/ui/WalletLogo";

interface WalletHeaderProps {
  onOpenNewTransaction?: () => void;
  onAddNewCard?: () => void;
  onImportStatement?: () => void;
  onOpenSimulator?: () => void;
  cardsCount: number;
  userName?: string;
}

export function WalletHeader({
  onOpenNewTransaction,
  onAddNewCard,
  onImportStatement,
  onOpenSimulator,
  cardsCount,
  userName,
}: WalletHeaderProps) {
  const firstName = userName ? userName.split(" ")[0] : null;

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
          <div className="flex items-center gap-2">
            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1D1D1F]"
              style={{ fontFamily: 'var(--font-sf-pro), -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}
            >
              Carteira
            </h1>
            {firstName && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 text-[#6E6E73]">
                {firstName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#86868B] font-normal mt-0.5">
            <span>
              {cardsCount} {cardsCount === 1 ? "cartão ativo" : "cartões ativos"}
            </span>
            <span className="text-[#C7C7CC]">·</span>
            <span>Visão Geral</span>
          </div>
        </div>
      </div>

      {/* Ações Rápidas Integradas no Cabeçalho */}
      <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
        {onOpenNewTransaction && (
          <button
            type="button"
            onClick={onOpenNewTransaction}
            className="flex-1 sm:flex-initial h-10 px-4 rounded-full bg-[#1D1D1F] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            title="Registrar novo gasto ou receita"
            data-testid="header-new-transaction-btn"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Lançar Gasto</span>
          </button>
        )}

        {onOpenSimulator && (
          <button
            type="button"
            onClick={onOpenSimulator}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-black/[0.04] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold border border-black/[0.08] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Simular se uma compra cabe no seu orçamento"
          >
            <Calculator size={14} strokeWidth={2} className="text-[#1D1D1F]" />
            <span>Devo comprar?</span>
          </button>
        )}

        {onImportStatement && (
          <button
            type="button"
            onClick={onImportStatement}
            className="h-10 px-3.5 rounded-full bg-white hover:bg-black/[0.04] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold border border-black/[0.08] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Importar extrato ou fatura do banco em PDF"
            data-testid="header-import-statement-btn"
          >
            <FileText size={14} strokeWidth={2} className="text-[#1D1D1F]" />
            <span className="hidden sm:inline">Importar Extrato PDF</span>
            <span className="sm:hidden">Extrato</span>
          </button>
        )}

        {onAddNewCard && (
          <button
            type="button"
            onClick={onAddNewCard}
            className="h-10 px-3.5 rounded-full bg-black/[0.04] hover:bg-black/[0.07] active:scale-[0.98] text-[#1D1D1F] text-xs font-semibold border border-black/[0.06] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Cadastrar novo cartão"
          >
            <CreditCard size={14} strokeWidth={2} className="text-[#86868B]" />
            <span className="hidden sm:inline">Novo Cartão</span>
            <span className="sm:hidden">Cartão</span>
          </button>
        )}
      </div>
    </header>
  );
}

