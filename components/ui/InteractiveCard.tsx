"use client";

import React, { useState, useRef, useCallback } from "react";
import { Wallet, Wifi, Plus, CreditCard, Edit3, Check, X } from "lucide-react";
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Estado para edição rápida do limite
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [tempLimit, setTempLimit] = useState(card.limit.toString());

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const maxRotateX = 12;
    const maxRotateY = 12;

    const rotateX = -((mouseY / (rect.height / 2)) * maxRotateX);
    const rotateY = (mouseX / (rect.width / 2)) * maxRotateY;

    const glareX = ((e.clientX - rect.left) / rect.width) * 100;
    const glareY = ((e.clientY - rect.top) / rect.height) * 100;

    setRotation({ x: rotateX, y: rotateY });
    setGlarePos({ x: glareX, y: glareY, opacity: 1 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isCredit = card.type === "credit";
  const displayedMainValue = isCredit ? card.invoiceAmount || 0 : card.balance || 0;
  const labelMainValue = isCredit ? "Fatura Atual" : "Saldo Atual";

  const percentUsed = Math.min(100, Math.round((card.spent / card.limit) * 100));

  const handleSaveLimit = () => {
    const num = parseFloat(tempLimit.replace(/\./g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) {
      onUpdateLimit(card.id, num);
    }
    setIsEditingLimit(false);
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Cartões Estilo Apple Wallet */}
      <div className="flex items-center justify-between px-1 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {allCards.map((c) => {
            const isSelected = c.id === card.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  onSelectCard(c.id);
                  setTempLimit(c.limit.toString());
                  setIsEditingLimit(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all select-none flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? "bg-[#1D1D1F] text-white shadow-xs"
                    : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.04]"
                }`}
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${c.colorScheme.gradient} border border-white/20`}
                />
                <span>{c.name}</span>
              </button>
            );
          })}

          {onOpenAddCard && (
            <button
              onClick={onOpenAddCard}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-[#86868B] hover:text-[#1D1D1F] border border-black/[0.04] transition-all flex items-center gap-1 shrink-0 cursor-pointer hover:shadow-2xs"
              title="Adicionar Novo Cartão"
            >
              <Plus size={13} strokeWidth={2} />
              <span>Novo Cartão</span>
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setTempLimit(card.limit.toString());
            setIsEditingLimit(!isEditingLimit);
          }}
          className="text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] flex items-center gap-1 transition-colors bg-white/70 hover:bg-white px-2.5 py-1 rounded-full border border-black/[0.04]"
        >
          <Edit3 strokeWidth={1.5} size={12} />
          <span>Ajustar Limite</span>
        </button>
      </div>

      {/* Cartão 3D Espacial */}
      <div className="[perspective:1000px] w-full">
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
            transition: isHovered
              ? "transform 0.15s ease-out"
              : "transform 0.5s ease-out",
          }}
          className={`relative group bg-gradient-to-br ${card.colorScheme.gradient} rounded-[24px] p-7 md:p-8 text-white border ${card.colorScheme.border} shadow-[0_20px_40px_rgba(0,0,0,0.25)] transform-gpu [transform-style:preserve-3d] select-none cursor-pointer overflow-hidden`}
        >
          {/* Camada Dinâmica de Reflexo Glare */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[24px] transition-opacity duration-300"
            style={{
              opacity: glarePos.opacity,
              background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.04) 45%, transparent 70%)`,
            }}
          />

          {/* Borda metálica superior */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Top Row: Marca do Cartão e Ícone Contactless */}
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 backdrop-blur-md border border-white/15 text-white flex items-center justify-center">
                <Wallet strokeWidth={1.5} size={15} />
              </div>
              <div>
                <span className="text-[11px] font-semibold tracking-widest text-white/70 uppercase block leading-none">
                  {card.colorScheme.badgeText}
                </span>
                <span className="text-[9px] text-[#86868B] block mt-0.5">
                  {card.brand}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Wifi strokeWidth={1.5} size={18} className="rotate-90 text-white/50" />
              <div
                className={`w-7 h-5 rounded bg-gradient-to-br ${card.colorScheme.chipGradient} opacity-75 border border-yellow-200/30`}
              />
            </div>
          </div>

          {/* Informações de Saldo ou Fatura */}
          <div className="space-y-1 relative z-10">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-[#86868B]">
              {labelMainValue}
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold text-white/90">R$</span>
              <span className="text-4xl md:text-5xl font-light tracking-tight text-white">
                {formatCurrency(displayedMainValue)}
              </span>
            </div>
          </div>

          {/* Botões Rápidos */}
          <div className="mt-7 flex flex-wrap items-center gap-3 relative z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddClick?.();
              }}
              className="bg-white text-[#1D1D1F] hover:bg-white/90 active:scale-[0.98] text-xs font-semibold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus strokeWidth={2} size={14} />
              <span>Novo Lançamento</span>
            </button>

            {isCredit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPayInvoice?.();
                }}
                className="bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white border border-white/15 text-xs font-medium px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
              >
                <CreditCard strokeWidth={1.5} size={14} />
                <span>Pagar Fatura</span>
              </button>
            )}

            {isCredit && card.dueDay && (
              <span className="text-[11px] text-white/60 ml-auto self-center">
                Vence dia {card.dueDay}
              </span>
            )}
          </div>

          {/* Rodapé: Gastos vs Limite e Barra de Progresso */}
          <div className="mt-7 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs relative z-10">
            <div className="flex items-center gap-2 text-[#86868B]">
              <span>{isCredit ? "Fatura / Limite:" : "Gastos no mês:"}</span>
              {isEditingLimit ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-lg border border-white/20"
                >
                  <span className="text-white font-medium">R$ {formatCurrency(card.spent)} / R$</span>
                  <input
                    type="number"
                    value={tempLimit}
                    onChange={(e) => setTempLimit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveLimit()}
                    className="w-20 bg-transparent text-white font-medium outline-none text-xs"
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
                <span className="font-medium text-white">
                  R$ {formatCurrency(card.spent)} / R$ {formatCurrency(card.limit)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-44">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed > 85 ? "bg-rose-500" : "bg-white"
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <span className="text-[10px] text-white/60 shrink-0 font-medium">
                {percentUsed}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
