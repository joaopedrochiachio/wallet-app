"use client";

import React, { useRef } from "react";

/**
 * Segmented Control — macOS 27 (Figma: "Segmented Controls" e "Toolbars")
 *
 * "content": cápsula com fundo 8% preto, segmento ativo azul com texto branco
 * e separadores de 1px que somem ao lado do segmento selecionado.
 * "toolbar": mesma estrutura sobre Liquid Glass, ativo em cinza (#e6e6e6).
 * Funciona como grupo de rádio: setas esquerda/direita trocam a opção.
 */

export type SegmentOption<V extends string = string> = {
  value: V;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** Esconde o texto em telas estreitas, mantendo só o ícone. */
  compactOnMobile?: boolean;
};

export interface MacSegmentedControlProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: SegmentOption<V>[];
  ariaLabel: string;
  variant?: "content" | "toolbar";
  size?: "small" | "regular";
  fullWidth?: boolean;
  className?: string;
}

export function MacSegmentedControl<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  variant = "content",
  size = "regular",
  fullWidth = false,
  className = "",
}: MacSegmentedControlProps<V>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const move = (direction: 1 | -1) => {
    const enabled = options.filter((option) => !option.disabled);
    const index = enabled.findIndex((option) => option.value === value);
    const next = enabled[(index + direction + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-variant={variant}
      data-size={size === "small" ? "small" : undefined}
      data-full-width={fullWidth || undefined}
      className={`mac-segmented ${className}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.compactOnMobile ? option.label : undefined}
            data-value={option.value}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className="mac-segment"
          >
            {option.icon}
            <span className={option.compactOnMobile ? "hidden sm:inline" : undefined}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
