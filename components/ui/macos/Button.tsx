"use client";

import React, { forwardRef } from "react";

/**
 * Button — macOS 27 (Figma: página "Buttons")
 *
 * Estilos do kit: Bordered, Tinted, Destructive, Prominent (padrão),
 * Prominent Destructive e Borderless, mais "glass" para botões sobre
 * Liquid Glass (toolbars e barras flutuantes). Raio 6px na área de conteúdo,
 * cápsula sobre vidro. Altura 24px (20 small, 28 large, 36 xl), 13px medium.
 */

export type MacButtonVariant =
  | "bordered"
  | "tinted"
  | "destructive"
  | "prominent"
  | "prominent-destructive"
  | "borderless"
  | "glass";

export interface MacButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MacButtonVariant;
  size?: "small" | "regular" | "large" | "xl";
  shape?: "rounded" | "capsule";
  icon?: React.ReactNode;
  /** Só ícone: o botão fica quadrado/circular. Exige aria-label. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

export const MacButton = forwardRef<HTMLButtonElement, MacButtonProps>(function MacButton(
  {
    variant = "bordered",
    size = "regular",
    shape = "rounded",
    icon,
    iconOnly = false,
    fullWidth = false,
    className = "",
    type = "button",
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size === "regular" ? undefined : size}
      data-shape={shape === "capsule" || variant === "glass" ? "capsule" : undefined}
      data-icon-only={iconOnly || undefined}
      data-full-width={fullWidth || undefined}
      className={`mac-button ${className}`}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
});

/** Grupo de vidro da toolbar (cápsula 36px com botões de 28px dentro). */
export function MacToolbarGroup({
  children,
  className = "",
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mac-toolbar-group ${className}`} {...rest}>
      {children}
    </div>
  );
}

export interface MacToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  /** Texto visível ao lado do ícone (some em telas estreitas se hideLabelOnMobile). */
  label?: string;
  hideLabelOnMobile?: boolean;
}

/** Botão de 28px usado dentro de MacToolbarGroup; aria-pressed marca o estado selecionado. */
export const MacToolbarButton = forwardRef<HTMLButtonElement, MacToolbarButtonProps>(
  function MacToolbarButton(
    { icon, label, hideLabelOnMobile = false, className = "", type = "button", children, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-labeled={label ? "" : undefined}
        className={`mac-toolbar-button ${className}`}
        {...rest}
      >
        {icon}
        {label && <span className={hideLabelOnMobile ? "hidden sm:inline" : undefined}>{label}</span>}
        {children}
      </button>
    );
  }
);

export function MacToolbarSeparator() {
  return <span className="mac-toolbar-separator" aria-hidden />;
}

/** Indicador de progresso indeterminado (spinner de 8 raios do macOS). */
export function MacSpinner({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`mac-spinner ${className}`}
      role="progressbar"
      aria-label="Carregando"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={i}
          x="7.1"
          y="1"
          width="1.8"
          height="4.2"
          rx="0.9"
          fill="currentColor"
          opacity={0.25 + (i / 8) * 0.75}
          transform={`rotate(${i * 45} 8 8)`}
        />
      ))}
    </svg>
  );
}
