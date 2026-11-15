"use client";

import React, { forwardRef } from "react";
import { Search, XCircle } from "lucide-react";

/**
 * Text Field e Search Field — macOS 27 (Figma: "Text Fields" e "Toolbars › Search")
 *
 * Text Field: 24px (28 large, 36 xl), raio 6px, fundo branco, borda de 1px 8%,
 * anel de foco azul de 3.5px. Search Field: cápsula de Liquid Glass com lupa,
 * texto 13px medium e botão de limpar quando há valor.
 */

export interface MacTextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "regular" | "large" | "xl";
}

export const MacTextField = forwardRef<HTMLInputElement, MacTextFieldProps>(function MacTextField(
  { size = "regular", className = "", ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      data-size={size === "regular" ? undefined : size}
      className={`mac-text-field ${className}`}
      {...rest}
    />
  );
});

export interface MacSearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  size?: "medium" | "xl";
  /** Rótulo acessível do botão de limpar. */
  clearLabel?: string;
}

export const MacSearchField = forwardRef<HTMLInputElement, MacSearchFieldProps>(function MacSearchField(
  { value, onChange, size = "xl", clearLabel = "Limpar busca", className = "", ...rest },
  ref
) {
  return (
    <div className={`mac-search-field ${className}`} data-size={size === "medium" ? "medium" : undefined}>
      <Search size={14} strokeWidth={2.2} aria-hidden className="shrink-0" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange("");
          }
        }}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onChange("")}
          className="shrink-0 rounded-full text-mac-label-3 transition-colors hover:text-mac-label-2"
        >
          <XCircle size={14} strokeWidth={2} fill="currentColor" className="text-mac-label-3 [&>*:not(:first-child)]:stroke-white" />
        </button>
      )}
    </div>
  );
});

/** Rótulo + campo no padrão de formulário macOS (rótulo 11px secundário acima). */
export function MacFormRow({
  label,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1 ${className}`}>
      <label htmlFor={htmlFor} className="block px-0.5 text-[11px] font-medium leading-[14px] text-mac-label-2">
        {label}
      </label>
      {children}
    </div>
  );
}
