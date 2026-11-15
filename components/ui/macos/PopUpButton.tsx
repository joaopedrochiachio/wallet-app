"use client";

import React, { useCallback, useId, useRef, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { MacMenu, type MacMenuEntry } from "./Menu";

/**
 * Pop-up Button — macOS 27 (Figma: "Pop-up and Pull-down Buttons")
 *
 * Escolhe um valor de uma lista. Cápsula com fundo 8% preto, rótulo 13px
 * medium e o símbolo chevron.up.chevron.down. Abre um Menu com checkmark no
 * item atual. Substitui o <select> nativo mantendo role="combobox".
 */

export type PopUpOption<V extends string = string> = {
  value: V;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
};

export type PopUpEntry<V extends string = string> =
  | PopUpOption<V>
  | { type: "separator"; key?: string }
  | { type: "header"; label: string; key?: string };

export interface PopUpButtonProps<V extends string = string> {
  value: V;
  onChange: (value: V) => void;
  options: PopUpEntry<V>[];
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  /** "filled" = cápsula cinza (padrão). "plain" = sem fundo, para linhas de formulário. */
  variant?: "filled" | "plain";
  /** Ocupa toda a largura do contêiner. */
  fullWidth?: boolean;
  /** Texto exibido quando o valor atual não está nas opções. */
  placeholder?: string;
  /** Formata o rótulo exibido no botão (ex.: "Categoria: Todas"). */
  renderValue?: (option: PopUpOption<V> | undefined) => string;
  className?: string;
}

function isOption<V extends string>(entry: PopUpEntry<V>): entry is PopUpOption<V> {
  return !("type" in entry);
}

export function PopUpButton<V extends string = string>({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  disabled = false,
  variant = "filled",
  fullWidth = false,
  placeholder = "Selecionar",
  renderValue,
  className = "",
}: PopUpButtonProps<V>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = `${useId()}-listbox`;

  const flatOptions = options.filter(isOption);
  const current = flatOptions.find((option) => option.value === value);
  // Valor fora da lista (ex.: categoria antiga) aparece como está, em vez de
  // fingir que a primeira opção está escolhida como o <select> nativo fazia.
  const label = renderValue
    ? renderValue(current)
    : current?.label ?? (value ? String(value) : placeholder);

  const entries: MacMenuEntry<V>[] = options.map((entry) =>
    isOption(entry) ? { ...entry, type: "item" as const } : entry
  );

  const close = useCallback(() => setOpen(false), []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        data-variant={variant}
        data-full-width={fullWidth || undefined}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`mac-popup-button ${className}`}
      >
        <span className="flex-1 min-w-0 truncate text-left">{label}</span>
        <span className="mac-popup-chevron" aria-hidden>
          <ChevronsUpDown size={13} strokeWidth={2.4} />
        </span>
      </button>
      <MacMenu
        id={menuId}
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        entries={entries}
        selectedValue={value}
        role="listbox"
        ariaLabel={ariaLabel}
        onSelect={(next) => {
          if (next !== value) onChange(next);
        }}
      />
    </>
  );
}
