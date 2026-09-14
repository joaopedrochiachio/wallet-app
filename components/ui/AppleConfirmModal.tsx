"use client";

import React from "react";
import Image from "next/image";
import { AlertCircle, Trash2, CreditCard } from "lucide-react";

export interface AppleConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "success";
  iconType?: "trash" | "payment" | "alert" | "wallet";
  isLoading?: boolean;
}

/**
 * Modal de Confirmação no Padrão Nativo Apple HIG (iOS Dialog Alert)
 * 100% nítido, sem travamento, com foco em usabilidade e segurança.
 */
export function AppleConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  iconType = "trash",
  isLoading = false,
}: AppleConfirmModalProps) {
  if (!isOpen) return null;

  const iconComponents = {
    trash: <Trash2 size={22} className="text-rose-600" />,
    payment: <CreditCard size={22} className="text-[#1D1D1F]" />,
    alert: <AlertCircle size={22} className="text-amber-600" />,
    wallet: (
      <Image
        src="/brand/wallet-icon.png"
        alt="Wallet"
        width={28}
        height={28}
        className="rounded-[6px] object-contain"
      />
    ),
  };

  const confirmColors = {
    danger: "bg-rose-600 hover:bg-rose-700 text-white",
    primary: "bg-[#1D1D1F] hover:bg-black text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop Limpo (Sem borrão) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 animate-apple-backdrop"
      />

      {/* Caixa de Diálogo iOS */}
      <div className="relative w-full max-w-sm bg-white rounded-[26px] p-6 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)] z-50 animate-apple-modal font-sans">
        {/* Ícone no topo */}
        <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center mx-auto shadow-2xs">
          {iconComponents[iconType] || iconComponents.alert}
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
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="py-3 px-4 rounded-xl text-xs font-semibold bg-[#F2F2F7] text-[#1D1D1F] hover:bg-gray-200 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={`py-3 px-4 rounded-xl text-xs font-semibold shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${confirmColors[variant]}`}
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
