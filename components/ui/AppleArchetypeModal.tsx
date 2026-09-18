"use client";

import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { FinancialPersonaId } from "@/types";

export interface ArchetypeModalOption {
  id: FinancialPersonaId;
  title: string;
  subtitle: string;
  modalSummary: string;
}

export const ARCHETYPE_MODAL_OPTIONS: ArchetypeModalOption[] = [
  {
    id: "optimizer",
    title: "The Optimizer",
    subtitle: "Eficiência e otimização financeira",
    modalSummary: "Prioriza eficiência, benefícios e melhor utilização dos recursos.",
  },
  {
    id: "guardian",
    title: "The Guardian",
    subtitle: "Segurança e previsibilidade",
    modalSummary: "Prioriza reserva, estabilidade e controle dos compromissos.",
  },
  {
    id: "scaler",
    title: "The Scaler",
    subtitle: "Crescimento e oportunidades",
    modalSummary:
      "Prioriza expansão patrimonial, investimentos e utilização estratégica da renda.",
  },
  {
    id: "minimalist",
    title: "The Minimalist",
    subtitle: "Simplicidade e independência",
    modalSummary:
      "Prioriza redução de custos, controle financeiro e construção de independência.",
  },
];

interface AppleArchetypeModalProps {
  isOpen: boolean;
  currentPersonaId?: FinancialPersonaId;
  onClose: () => void;
  onConfirm: (personaId: FinancialPersonaId) => void;
}

export function AppleArchetypeModal({
  isOpen,
  currentPersonaId,
  onClose,
  onConfirm,
}: AppleArchetypeModalProps) {
  if (!isOpen) return null;

  return (
    <AppleArchetypeModalContent
      currentPersonaId={currentPersonaId}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function AppleArchetypeModalContent({
  currentPersonaId,
  onClose,
  onConfirm,
}: Omit<AppleArchetypeModalProps, "isOpen">) {
  const [selectedId, setSelectedId] = useState<FinancialPersonaId>(
    currentPersonaId || "optimizer"
  );

  const handleConfirm = () => {
    onConfirm(selectedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop Apple-like */}
      <div
        className="fixed inset-0 bg-black/45 animate-apple-backdrop"
        onClick={onClose}
      />

      {/* Modal / Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] shadow-[0_25px_60px_rgba(0,0,0,0.22)] border border-black/[0.06] overflow-hidden z-10 flex flex-col max-h-[90dvh] sm:max-h-[85vh] animate-apple-sheet sm:animate-apple-modal font-sans pb-safe">
        {/* iOS Handle Indicator (mobile only) */}
        <div className="sm:hidden w-10 h-1 bg-[#D1D1D6] rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/[0.05]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#1D1D1F] tracking-tight">
                Alterar arquétipo
              </h2>
              <p className="text-xs text-[#86868B] leading-relaxed mt-1.5">
                Seu arquétipo influencia a forma como o Advisor interpreta suas finanças e formula recomendações. Altere quando seus objetivos ou sua estratégia financeira mudarem.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#F2F2F7] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] transition-colors flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
              aria-label="Fechar"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Archetype Options List */}
        <div className="overflow-y-auto px-6 py-4 space-y-3">
          {ARCHETYPE_MODAL_OPTIONS.map((option) => {
            const isSelected = selectedId === option.id;
            const isCurrentlyActive = currentPersonaId === option.id;

            return (
              <div
                key={option.id}
                onClick={() => setSelectedId(option.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-start gap-3.5 ${
                  isSelected
                    ? "border-[#1D1D1F] bg-[#F2F2F7]/50 shadow-2xs"
                    : "border-black/[0.06] bg-white hover:border-black/15 hover:bg-[#F2F2F7]/20"
                }`}
              >
                {/* Radio selection circle */}
                <div
                  className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "border-[#1D1D1F] bg-[#1D1D1F]"
                      : "border-[#C7C7CC] bg-white"
                  }`}
                >
                  {isSelected && <Check size={10} className="text-white stroke-[3]" />}
                </div>

                {/* Information */}
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[#1D1D1F] tracking-tight">
                      {option.title}
                    </h3>
                    {isCurrentlyActive && (
                      <span className="text-[10px] text-[#86868B] font-medium uppercase tracking-wider bg-black/[0.04] px-2 py-0.5 rounded-full">
                        Ativo atualmente
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#86868B] font-medium">
                    {option.subtitle}
                  </p>
                  <p className="text-xs text-[#636366] leading-relaxed pt-0.5">
                    {option.modalSummary}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé / Ações */}
        <div className="px-6 py-4 border-t border-black/[0.05] bg-[#FAFAFA] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto h-11 sm:h-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-[#1D1D1F] bg-[#E5E5EA]/70 hover:bg-[#E5E5EA] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto h-11 sm:h-auto px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#1D1D1F] hover:bg-black active:scale-[0.98] transition-all shadow-xs cursor-pointer flex items-center justify-center"
          >
            Definir como meu arquétipo
          </button>
        </div>
      </div>
    </div>
  );
}
