"use client";

import React, { useCallback, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MacMenu, type MacMenuEntry } from "./Menu";

/**
 * Pull-down Button — macOS 27 (Figma: "Pop-up and Pull-down Buttons")
 *
 * Abre uma lista de ações (não guarda valor). Com `label`, é a cápsula com
 * chevron.down do kit; com `icon` e sem `label`, vira o botão "•••" de ações
 * contextuais usado nas linhas de lista.
 */

export interface PullDownButtonProps<V extends string = string> {
  items: MacMenuEntry<V>[];
  onAction: (value: V) => void;
  label?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  align?: "start" | "end";
  /** Classes extras para o botão gatilho. */
  className?: string;
}

export function PullDownButton<V extends string = string>({
  items,
  onAction,
  label,
  icon,
  ariaLabel,
  disabled = false,
  align = "start",
  className = "",
}: PullDownButtonProps<V>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = `${useId()}-menu`;
  const close = useCallback(() => setOpen(false), []);
  const isIconOnly = !label && !!icon;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel ?? label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={
          isIconOnly
            ? `inline-flex items-center justify-center w-8 h-8 rounded-full text-mac-label-2 hover:text-mac-label hover:bg-mac-fill-2 aria-expanded:bg-mac-fill aria-expanded:text-mac-label transition-colors outline-none focus-visible:ring-2 focus-visible:ring-mac-blue/50 ${className}`
            : `mac-popup-button ${className}`
        }
      >
        {isIconOnly ? (
          icon
        ) : (
          <>
            {icon}
            <span className="flex-1 min-w-0 truncate text-left">{label}</span>
            <span className="mac-popup-chevron" aria-hidden>
              <ChevronDown size={13} strokeWidth={2.6} />
            </span>
          </>
        )}
      </button>
      <MacMenu
        id={menuId}
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        entries={items}
        role="menu"
        align={align}
        matchAnchorWidth={!isIconOnly}
        ariaLabel={ariaLabel ?? label}
        onSelect={onAction}
      />
    </>
  );
}
