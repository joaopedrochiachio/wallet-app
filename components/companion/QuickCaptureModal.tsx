"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/context/WalletContext";
import { parseQuickExpenseText } from "@/lib/services/dailyCompanionService";
import { AgentAvatar } from "./AgentAvatar";
import {
  Sparkles,
  X,
  Send,
  CreditCard,
  Tag,
  CheckCircle2,
  Utensils,
  Car,
  ShoppingBag,
  Coffee,
  HeartPulse,
} from "lucide-react";

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function QuickCaptureModal({ isOpen, onClose, onSuccess }: QuickCaptureModalProps) {
  const { cards, addTransaction, userProfile } = useWallet();
  const [inputText, setInputText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Cartões disponíveis para o parser
  const cardOptions = useMemo(
    () => cards.map((c) => ({ id: c.id, name: c.name })),
    [cards]
  );

  // Parse dinâmico em tempo real conforme digita
  const parsed = useMemo(() => {
    return parseQuickExpenseText(inputText, cardOptions, "Débito/Pix");
  }, [inputText, cardOptions]);

  // Se fechar ou abrir, resetar estados
  useEffect(() => {
    if (isOpen) {
      setInputText("");
      setJustSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickChip = (chipText: string) => {
    setInputText((prev) => {
      if (!prev.trim()) return chipText + " ";
      return `${chipText} ${prev.replace(/^[a-zA-Záàâãéèêíïóôõöúçñ\s]+/i, "").trim()}`;
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (parsed.amount <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addTransaction({
        title: parsed.title,
        amount: parsed.amount,
        type: "despesa",
        category: parsed.category,
        account: parsed.account,
        cardId: parsed.cardId || null,
        date: new Date().toISOString().split("T")[0],
        occurredAt: new Date().toISOString(),
        isRecurring: Boolean(parsed.installmentsCount && parsed.installmentsCount > 1),
        installmentsCount: parsed.installmentsCount,
      });

      setJustSaved(true);
      if (onSuccess) onSuccess();

      // Fecha suavemente após a animação de sucesso
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error("Erro ao salvar captura rápida:", err);
      setIsSubmitting(false);
    }
  };

  const quickChips = [
    { label: "Almoço", icon: <Utensils size={12} /> },
    { label: "Uber", icon: <Car size={12} /> },
    { label: "Café", icon: <Coffee size={12} /> },
    { label: "Mercado", icon: <ShoppingBag size={12} /> },
    { label: "Farmácia", icon: <HeartPulse size={12} /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex sm:items-center items-end justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] bg-white/95 backdrop-blur-2xl border border-black/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.18)] overflow-hidden flex flex-col relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92dvh] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Pull Indicator para Mobile PWA */}
        <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mt-2.5 sm:hidden relative z-20 shrink-0" />

        {/* Glow Superior */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-500/10 via-orange-500/5 to-transparent pointer-events-none" />

        {/* Header do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-6 pb-3 sm:pb-4 border-b border-black/[0.05] relative z-10">
          <div className="flex items-center gap-3 min-w-0">
            <AgentAvatar
              persona={userProfile.persona || "guardian"}
              state={justSaved ? "celebrating" : isSubmitting ? "thinking" : "idle"}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Captura Rápida
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                  Linguagem Natural
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-[#1D1D1F] truncate">
                Registrar gasto em segundos
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 text-[#86868B] hover:text-[#1D1D1F] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo Principal */}
        <div className="p-4 sm:p-6 space-y-4 relative z-10 overflow-y-auto">
          {justSaved ? (
            <div className="py-6 sm:py-8 text-center space-y-3 animate-in zoom-in duration-300">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1D1D1F]">
                  Gasto Registrado!
                </h3>
                <p className="text-xs text-[#86868B] mt-0.5">
                  {parsed.title} • R$ {parsed.amount.toFixed(2)} lançado em {parsed.account}.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chips de Atalho Rápido */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <span className="text-[11px] font-semibold text-[#86868B] shrink-0 mr-1">
                  Exemplos:
                </span>
                {quickChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleQuickChip(chip.label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F2F2F7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-medium transition-all shrink-0 cursor-pointer active:scale-95 border border-black/5"
                  >
                    {chip.icon}
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>

              {/* Caixa de Entrada Inteligente */}
              <form onSubmit={handleSave} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Ex: Almoço 38,50 no nubank ou Uber 22"
                    autoFocus
                    className="w-full text-base sm:text-lg font-medium px-4 py-3 sm:py-3.5 rounded-2xl bg-[#F2F2F7] border border-black/5 focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-[#A1A1A6]"
                  />
                  {inputText.trim() && (
                    <button
                      type="button"
                      onClick={() => setInputText("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#86868B] hover:text-[#1D1D1F] px-2 py-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Prévia do Parse Compacta e Elegante para Mobile */}
                <div className="p-3.5 rounded-2xl bg-[#FAFAFC] border border-black/[0.04] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[#86868B] text-[11px] font-semibold uppercase tracking-wider">
                    <span>O que o assistente entendeu:</span>
                    {parsed.amount > 0 && (
                      <span className="text-emerald-600 font-bold">✓ Pronto para salvar</span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] tabular-nums">
                      {parsed.amount > 0 ? `R$ ${parsed.amount.toFixed(2)}` : "R$ 0,00"}
                    </span>
                    <span className="text-xs font-semibold text-[#86868B] truncate max-w-[150px]">
                      {parsed.title}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-black/[0.04]">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white border border-black/5 text-[#1D1D1F]">
                      <span>🏷️</span>
                      <span>{parsed.category}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white border border-black/5 text-[#1D1D1F]">
                      <CreditCard size={11} className="text-[#86868B]" />
                      <span>{parsed.account}</span>
                    </span>
                    {parsed.installmentsCount && parsed.installmentsCount > 1 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/70 text-indigo-700 font-mono tabular-nums">
                        {parsed.installmentsCount}x de R$ {(parsed.amount / parsed.installmentsCount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Botão de Envio */}
                <button
                  type="submit"
                  disabled={parsed.amount <= 0 || isSubmitting}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] ${
                    parsed.amount > 0 && !isSubmitting
                      ? "bg-[#1D1D1F] hover:bg-black text-white shadow-md active:scale-[0.99]"
                      : "bg-[#E5E5EA] text-[#86868B] cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? (
                    <span>Registrando na carteira...</span>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Confirmar Registro • R$ {parsed.amount.toFixed(2)}</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
