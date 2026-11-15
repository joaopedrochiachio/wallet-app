"use client";

import React, { useEffect, useId } from "react";
import { X } from "lucide-react";
import { Portal } from "../Portal";

/**
 * Window, Toolbar e Sheet — macOS 27 (Figma: páginas "Windows" e "Sheets")
 *
 * Janela: raio 16px, sombra de janela ativa. Toolbar unificada: 52px, branco
 * 85% com borda inferior de 0.67px, título 13px bold e subtítulo 11px.
 * Sheet: painel branco raio 16px sobre overlay, com toolbar própria.
 */

export function MacWindowToolbar({
  title,
  subtitle,
  leading,
  trailing,
  className = "",
  titleId,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <div className={`mac-window-toolbar ${className}`}>
      {leading}
      {(title || subtitle) && (
        <div className="flex min-w-0 flex-col gap-0.5">
          {title && (
            <span id={titleId} className="mac-window-title truncate">
              {title}
            </span>
          )}
          {subtitle && <span className="mac-window-subtitle truncate">{subtitle}</span>}
        </div>
      )}
      <div className="min-w-2 flex-1" />
      {trailing}
    </div>
  );
}

export interface MacSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Largura máxima do painel. */
  maxWidthClass?: string;
  icon?: React.ReactNode;
}

export function MacSheet({ isOpen, onClose, title, subtitle, children, maxWidthClass = "max-w-4xl", icon }: MacSheetProps) {
  const titleId = useId();

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
      <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-3 pt-[max(12px,env(safe-area-inset-top))] sm:p-6 sm:pt-10">
        <div
          className="fixed inset-0 animate-apple-backdrop"
          style={{ background: "var(--mac-overlay)" }}
          onClick={onClose}
          aria-hidden
        />
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`mac-sheet animate-mac-sheet relative z-10 flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden ${maxWidthClass}`}
        >
          <MacWindowToolbar
            titleId={titleId}
            title={title}
            subtitle={subtitle}
            leading={icon ? <span className="flex text-mac-label" aria-hidden>{icon}</span> : undefined}
            trailing={
              <button
                type="button"
                aria-label="Fechar"
                onClick={onClose}
                className="mac-toolbar-button"
              >
                <X size={15} strokeWidth={2} />
              </button>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F5F5F7] p-4 sm:p-6">
            {children}
          </div>
        </section>
      </div>
    </Portal>
  );
}
