"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";
import type { CardItem } from "@/types";
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/utils/creditCardEngine";

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Money({
  value,
  className = "",
  sign,
}: {
  value: number;
  className?: string;
  sign?: "+" | "−";
}) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {sign ? `${sign} ` : ""}R$ {formatBRL(value)}
    </span>
  );
}

const STATUS_STYLE: Record<InvoiceStatus, string> = {
  open: "bg-indigo-50 text-indigo-700",
  closed: "bg-amber-50 text-amber-800",
  overdue: "bg-rose-50 text-rose-700",
  paid: "bg-emerald-50 text-emerald-700",
  settled: "bg-[#F2F2F7] text-[#86868B]",
  future: "bg-[#F2F2F7] text-[#86868B]",
  empty: "bg-[#F2F2F7] text-[#86868B]",
};

export function InvoiceStatusPill({ status, className = "" }: { status: InvoiceStatus; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[status]} ${className}`}
    >
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}

/** Cor de destaque do cartão (para barras e pontos de gráfico). */
export function cardAccent(card: Pick<CardItem, "name" | "colorScheme">): string {
  const name = card.name.trim().toLowerCase();
  if (name.includes("nubank") || name === "nu") return "#820AD1";
  if (name.includes("santander")) return "#EC0000";
  if (name.includes("inter")) return "#FF7A00";
  if (name.includes("itau") || name.includes("itaú")) return "#EC7000";
  if (name.includes("bradesco")) return "#CC092F";
  if (name.includes("c6")) return "#6E6E73";
  if (name.includes("xp")) return "#64748B";
  if (name.includes("btg")) return "#0B2A4A";
  const accent = card.colorScheme?.accent;
  if (accent && /^#|^rgb/.test(accent)) return accent;
  return "#5E5CE6";
}

export function CardDot({ card, size = 10 }: { card: Pick<CardItem, "name" | "colorScheme">; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: cardAccent(card) }}
    />
  );
}

/** Sheet inferior (mobile) / modal central (desktop), no padrão das outras telas. */
export function Sheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  zIndexClass = "z-[105]",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndexClass?: string;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className={`fixed inset-0 ${zIndexClass} flex items-end sm:items-center justify-center sm:p-4`}>
        <div onClick={onClose} className="fixed inset-0 bg-black/45 animate-apple-backdrop" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] animate-apple-sheet sm:max-h-[86vh] sm:rounded-[28px] sm:animate-apple-modal"
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-[#1D1D1F]">{title}</h2>
              {subtitle && <div className="mt-0.5 text-xs text-[#86868B]">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="touch-min flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F2F2F7] text-[#86868B] transition-colors hover:text-[#1D1D1F]"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="border-t border-black/[0.06] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}

export function parseCurrencyInput(raw: string): number {
  const cleaned = raw.replace(/[R$\s]/g, "").trim();
  if (!cleaned) return NaN;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  if (cleaned.includes(",")) return parseFloat(cleaned.replace(",", "."));
  return parseFloat(cleaned);
}
