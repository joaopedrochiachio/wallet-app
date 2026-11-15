"use client";

import React from "react";
import { MacAlert } from "./macos/Alert";

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
 * Confirmação no padrão macOS 27 (Alert empilhado).
 * Ações destrutivas usam o botão vermelho translúcido; as demais, o azul primário.
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
  return (
    <MacAlert
      isOpen={isOpen}
      title={title}
      description={description}
      onCancel={onClose}
      isLoading={isLoading}
      showCaution={iconType === "alert" || variant === "danger"}
      actions={[
        {
          label: confirmLabel,
          kind: variant === "danger" ? "destructive" : "primary",
          onPress: onConfirm,
          isDefault: true,
        },
        { label: cancelLabel, kind: "secondary", onPress: onClose },
      ]}
    />
  );
}
