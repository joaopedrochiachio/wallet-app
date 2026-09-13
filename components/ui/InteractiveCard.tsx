"use client";

import React, { useState } from "react";
import {
  Wifi,
  Plus,
  CreditCard,
  Edit3,
  Check,
  X,
  MoreHorizontal,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { CardItem } from "@/context/WalletContext";

export interface InteractiveCardProps {
  card: CardItem;
  allCards: CardItem[];
  onSelectCard: (cardId: string) => void;
  onUpdateLimit: (cardId: string, newLimit: number) => void;
  onAddClick?: () => void;
  onPayInvoice?: () => void;
  onOpenAddCard?: () => void;
}

export function InteractiveCard({
  card,
  allCards,
  onSelectCard,
  onUpdateLimit,
  onAddClick,
  onPayInvoice,
  onOpenAddCard,
}: InteractiveCardProps) {
  // Estado para edição rápida do limite
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [tempLimit, setTempLimit] = useState(card.limit.toString());
  const [showMenu, setShowMenu] = useState(false);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCredit = card.type === "credit";
  const displayedMainValue = isCredit ? card.invoiceAmount || 0 : card.balance || 0;
  const labelMainValue = isCredit ? "Fatura em Aberto" : "Saldo Disponível";

  const handleSaveLimit = () => {
    const num = parseFloat(tempLimit.replace(/\./g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) {
      onUpdateLimit(card.id, num);
    }
    setIsEditingLimit(false);
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Header / Seletor de Passes Apple Wallet */}
      <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {allCards.map((c) => {
            const isSelected = c.id === card.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  onSelectCard(c.id);
                  setTempLimit(c.limit.toString());
                  setIsEditingLimit(false);
                  setShowMenu(false);
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all select-none flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white shadow-xs"
                    : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.05]"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${c.colorScheme.gradient} border border-white/30`}
                />
                <span>{c.name}</span>
              </button>
            );
          })}

          {onOpenAddCard && (
            <button
              onClick={onOpenAddCard}
              className="px-3.5 py-2 rounded-full text-xs font-semibold bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.05] transition-all flex items-center gap-1 shrink-0 cursor-pointer hover:shadow-2xs"
              title="Adicionar Novo Pass"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>Novo Pass</span>
            </button>
          )}
        </div>

        {/* Botão de Ajustar Limite / Opções */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.05] flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
            title="Mais Opções do Pass"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-2xl shadow-xl border border-black/[0.06] p-2 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setTempLimit(card.limit.toString());
                  setIsEditingLimit(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7] rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Ajustar Limite</span>
              </button>
              {isCredit && onPayInvoice && (
                <button
                  onClick={() => {
                    onPayInvoice();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F2F2F7] rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CreditCard size={13} />
                  <span>Pagar Fatura Atual</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PASS FÍSICO ESTILO NATIVO APPLE WALLET (SEM EFEITO 3D ROTACIONAL) */}
      <div className="w-full max-w-xl mx-auto">
        <div
          className={`relative bg-gradient-to-br ${card.colorScheme.gradient} rounded-[28px] md:rounded-[32px] p-7 md:p-8 text-white border ${card.colorScheme.border} shadow-[0_16px_36px_rgba(0,0,0,0.14)] select-none overflow-hidden transition-all duration-300`}
        >
          {/* Top Notch / Recorte sutil de pegada do Pass Apple */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-white/10 rounded-b-full" />

          {/* Borda metálica sutil superior */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* Header do Pass: Marca, Nome e Status */}
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white flex items-center justify-center shadow-xs">
                {isCredit ? <CreditCard size={18} strokeWidth={1.5} /> : <ShieldCheck size={18} strokeWidth={1.5} />}
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white leading-tight">
                  {card.name}
                </h2>
                <span className="text-[11px] font-medium text-white/60 block">
                  {card.brand}
                </span>
              </div>
            </div>

            {/* Badge de Categoria e Ícone Contactless */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 text-white/90 border border-white/10">
                {card.colorScheme.badgeText}
              </span>
              <Wifi size={18} strokeWidth={2} className="rotate-90 text-white/60" />
            </div>
          </div>

          {/* Valor Principal (Saldo Disponível ou Fatura) com Tipografia Gigante Apple */}
          <div className="space-y-1 relative z-10 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-white/60">
              {labelMainValue}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-light text-white/70">R$</span>
              <span className="text-4xl sm:text-5xl font-light tracking-tight text-white">
                {formatCurrency(displayedMainValue)}
              </span>
            </div>
          </div>

          {/* Linha Divisória Perfurada Estilo Pass Kit */}
          <div className="my-6 border-b border-white/15 relative">
            <div className="absolute -left-10 -top-2.5 w-5 h-5 rounded-full bg-[#F2F2F7]" />
            <div className="absolute -right-10 -top-2.5 w-5 h-5 rounded-full bg-[#F2F2F7]" />
          </div>

          {/* Dados Auxiliares do Pass (Grade de Informações Físicas) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs relative z-10">
            <div>
              <span className="text-[9px] uppercase font-semibold text-white/50 tracking-wider block">
                {isCredit ? "Limite Total" : "Tipo de Conta"}
              </span>
              {isEditingLimit ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-lg border border-white/20 mt-0.5"
                >
                  <span className="text-white text-xs">R$</span>
                  <input
                    type="number"
                    value={tempLimit}
                    onChange={(e) => setTempLimit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveLimit()}
                    className="w-16 bg-transparent text-white font-semibold outline-none text-xs"
                    autoFocus
                  />
                  <button onClick={handleSaveLimit} className="text-emerald-400 hover:text-emerald-300">
                    <Check size={13} />
                  </button>
                  <button onClick={() => setIsEditingLimit(false)} className="text-gray-400 hover:text-white">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold text-white/90 block mt-0.5">
                  {isCredit ? `R$ ${formatCurrency(card.limit)}` : "Movimentação Pix"}
                </span>
              )}
            </div>

            <div>
              <span className="text-[9px] uppercase font-semibold text-white/50 tracking-wider block">
                {isCredit ? "Vencimento" : "Status"}
              </span>
              <span className="text-sm font-semibold text-white/90 block mt-0.5">
                {isCredit && card.dueDay ? `Todo dia ${card.dueDay}` : "Ativo • Protegido"}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center justify-start sm:justify-end gap-2">
              <div
                className={`w-8 h-5 rounded bg-gradient-to-br ${card.colorScheme.chipGradient} border border-yellow-200/40 opacity-90 shadow-2xs`}
                title="Microchip EMV"
              />
            </div>
          </div>
        </div>

        {/* NATIVE APPLE WALLET READER / ACTION BAR (Inspirado no visual da imagem 2) */}
        <div className="pt-6 pb-2 flex flex-col items-center justify-center space-y-4 text-center">
          {/* Símbolo Circular do Leitor Apple Wallet */}
          <div
            onClick={onAddClick}
            className="w-16 h-16 rounded-full border-2 border-[#007AFF] bg-[#007AFF]/5 hover:bg-[#007AFF]/10 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs group"
            title="Lançamento Rápido"
          >
            <Smartphone size={26} strokeWidth={1.5} className="text-[#007AFF] group-hover:scale-105 transition-transform" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#1D1D1F] block">
              Wallet Pass • Pronto para uso
            </span>
            <p className="text-[11px] text-[#86868B]">
              Toque no leitor acima ou no botão abaixo para adicionar uma movimentação
            </p>
          </div>

          {/* Botões de Ação Táteis */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onAddClick}
              className="bg-[#1D1D1F] hover:bg-black text-white text-xs font-semibold px-5 py-3 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus strokeWidth={2.5} size={15} />
              <span>Novo Lançamento</span>
            </button>

            {isCredit && onPayInvoice && (
              <button
                onClick={onPayInvoice}
                disabled={card.invoiceAmount === 0}
                className={`text-xs font-semibold px-4 py-3 rounded-full transition-all flex items-center gap-1.5 border cursor-pointer active:scale-95 ${
                  (card.invoiceAmount || 0) > 0
                    ? "bg-white text-[#1D1D1F] border-black/10 hover:bg-gray-50 shadow-2xs"
                    : "bg-gray-100 text-gray-400 border-transparent cursor-not-allowed"
                }`}
              >
                <CreditCard size={14} />
                <span>Pagar Fatura</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
