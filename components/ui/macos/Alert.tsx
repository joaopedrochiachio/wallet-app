"use client";

import React, { useEffect, useId, useRef } from "react";
import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { Portal } from "../Portal";

/**
 * Alert — macOS 27 (Figma: página "Alerts", tipo "Stacked")
 *
 * Vidro com raio 34px, ícone do app, título 13px bold e descrição 11px,
 * alinhados à esquerda, com botões empilhados em cápsula: primário azul,
 * destrutivo vermelho translúcido e secundário cinza. Overlay cinza 60%.
 */

export type MacAlertButtonKind = "primary" | "destructive" | "secondary";

export interface MacAlertAction {
  label: string;
  kind: MacAlertButtonKind;
  onPress: () => void;
  /** Botão acionado pela tecla Enter (recebe o foco inicial). */
  isDefault?: boolean;
}

export interface MacAlertProps {
  isOpen: boolean;
  title: string;
  description?: string;
  actions: MacAlertAction[];
  /** Esc e clique no overlay chamam esta função. */
  onCancel: () => void;
  isLoading?: boolean;
  /** Mostra o selo de atenção sobre o ícone do app. */
  showCaution?: boolean;
  zIndexClass?: string;
}

export function MacAlert({
  isOpen,
  title,
  description,
  actions,
  onCancel,
  isLoading = false,
  showCaution = false,
  zIndexClass = "z-[100]",
}: MacAlertProps) {
  const titleId = useId();
  const descriptionId = useId();
  const defaultButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    defaultButtonRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus?.({ preventScroll: true });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" && !isLoading) {
      event.preventDefault();
      onCancel();
      return;
    }
    // Mantém o foco preso dentro do alerta.
    if (event.key === "Tab") {
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []
      );
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <Portal>
      <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4`}>
        <div
          onClick={() => !isLoading && onCancel()}
          className="fixed inset-0 animate-apple-backdrop"
          style={{ background: "var(--mac-overlay)" }}
        />

        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          onKeyDown={handleKeyDown}
          className="mac-material-alert animate-apple-modal relative z-10 flex w-full max-w-[260px] flex-col items-center gap-3.5 px-4 pb-4 pt-5 [@media(pointer:coarse)]:max-w-[300px]"
        >
          <div className="flex w-full flex-col gap-2.5 px-1.5 pb-0.5 text-[var(--mac-label-primary)]">
            <div className="relative h-12 w-12">
              <Image
                src="/brand/wallet-icon.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-[11px] object-contain"
              />
              {showCaution && (
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-mac-yellow text-black shadow-sm" aria-hidden>
                  <AlertTriangle size={13} strokeWidth={2.4} />
                </span>
              )}
            </div>
            <p id={titleId} className="text-[13px] font-bold leading-4">
              {title}
            </p>
            {description && (
              <p id={descriptionId} className="text-[11px] font-normal leading-[14px]">
                {description}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-1.5">
            {actions.map((action) => (
              <button
                key={action.label}
                ref={action.isDefault ? defaultButtonRef : undefined}
                type="button"
                data-kind={action.kind}
                disabled={isLoading}
                onClick={action.onPress}
                className="mac-alert-button"
              >
                {isLoading && action.isDefault ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  action.label
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Portal>
  );
}
