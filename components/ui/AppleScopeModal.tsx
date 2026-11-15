"use client";

import React from "react";
import { MacAlert } from "./macos/Alert";

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
 * Escolha de escopo no padrão macOS 27 (Alert empilhado com três botões).
 * Aplica a alteração/exclusão só na ocorrência do mês ou em todas as
 * ocorrências do compromisso recorrente/parcelado.
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
  const isDanger = variant === "danger";

  return (
    <MacAlert
      isOpen={isOpen}
      title={title}
      description={description}
      onCancel={onClose}
      isLoading={isLoading}
      showCaution={isDanger}
      zIndexClass="z-[110]"
      actions={[
        {
          label: singleLabel,
          kind: isDanger ? "destructive" : "primary",
          onPress: () => onSelectScope("single"),
          isDefault: true,
        },
        {
          label: allLabel,
          kind: isDanger ? "destructive" : "secondary",
          onPress: () => onSelectScope("all"),
        },
        { label: cancelLabel, kind: "secondary", onPress: onClose },
      ]}
    />
  );
}
