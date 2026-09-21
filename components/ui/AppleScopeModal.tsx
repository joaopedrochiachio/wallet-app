"use client";

import React from "react";
import { Trash2, Repeat } from "lucide-react";

export interface AppleScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScope: (scope: "single" | "all") => void;
  title: string;
  description: string;
  singleLabel?: string;
  allLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  isLoading?: boolean;
}

/**
 * Modal de Seleção de Escopo no Padrão Nativo Apple HIG (iOS Action Dialog)
 * Permite ao usuário escolher aplicar alteração/exclusão apenas na ocorrência do mês selecionado
 * ou propagar para todas as ocorrências do compromisso recorrente/parcelado.
 */
export function AppleScopeModal({
  isOpen,
  onClose,
  onSelectScope,
  title,
  description,
  singleLabel = "Apenas nesta ocorrência",
  allLabel = "Todas as ocorrências",
  cancelLabel = "Cancelar",
  variant = "primary",
  isLoading = false,
}: AppleScopeModalProps) {
  if (!isOpen) return null;

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop com Blur Suave */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-xs animate-apple-backdrop"
      />

      {/* Caixa de Diálogo iOS */}
      <div className="relative w-full max-w-sm bg-white rounded-t-[28px] sm:rounded-[26px] p-6 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)] z-50 animate-apple-sheet sm:animate-apple-modal font-sans pb-safe">
        {/* Pílula no Mobile */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto -mt-2 mb-2 sm:hidden" />

        {/* Ícone no topo */}
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto shadow-2xs ${
            isDanger ? "bg-rose-50 text-rose-600" : "bg-[#F2F2F7] text-[#1D1D1F]"
          }`}
        >
          {isDanger ? <Trash2 size={22} /> : <Repeat size={22} />}
        </div>

        {/* Textos */}
        <div className="space-y-1.5 px-1">
          <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-[#86868B] leading-relaxed">
            {description}
          </p>
        </div>

        {/* Botões de Ação estilo iOS */}
        <div className="space-y-2 pt-1">
          {/* Opção 1: Apenas nesta ocorrência */}
          <button
            type="button"
            onClick={() => onSelectScope("single")}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl text-xs font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-[#1D1D1F] hover:bg-black text-white"
            }`}
          >
            {singleLabel}
          </button>

          {/* Opção 2: Todas as ocorrências */}
          <button
            type="button"
            onClick={() => onSelectScope("all")}
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl text-xs font-semibold border active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              isDanger
                ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                : "border-black/10 bg-white text-[#1D1D1F] hover:bg-[#F2F2F7]"
            }`}
          >
            {allLabel}
          </button>

          {/* Cancelar */}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
