"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Portal } from "../Portal";

/**
 * Menu — macOS 27 (Figma: página "Menus")
 *
 * Fundo de vidro com raio 12px, itens de 24px (40px em telas touch), destaque
 * arredondado 8px, separadores de 11px, cabeçalhos em negrito secundário,
 * checkmark para o item selecionado e atalhos em cor terciária.
 */

export type MacMenuItem<V extends string = string> = {
  type?: "item";
  value: V;
  label: string;
  /** Segunda linha em cor secundária (NSMenuItem.subtitle). */
  subtitle?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  destructive?: boolean;
  /** Item que navega (renderizado como link). */
  href?: string;
};

export type MacMenuEntry<V extends string = string> =
  | MacMenuItem<V>
  | { type: "separator"; key?: string }
  | { type: "header"; label: string; key?: string };

type Placement = { top: number; left: number; minWidth: number; maxHeight: number };

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 6;

function isItem<V extends string>(entry: MacMenuEntry<V>): entry is MacMenuItem<V> {
  return entry.type === undefined || entry.type === "item";
}

export interface MacMenuProps<V extends string = string> {
  open: boolean;
  onClose: (reason?: "select" | "escape" | "outside" | "tab") => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  entries: MacMenuEntry<V>[];
  onSelect: (value: V) => void;
  /** Valor marcado com checkmark (pop-up buttons). */
  selectedValue?: V;
  /** "listbox" para Pop-up Button (escolha de valor), "menu" para ações. */
  role?: "listbox" | "menu";
  /** Alinhamento horizontal em relação ao gatilho. */
  align?: "start" | "end";
  id?: string;
  ariaLabel?: string;
  /** Faz o menu ter pelo menos a largura do gatilho. */
  matchAnchorWidth?: boolean;
}

/** Só monta o painel quando aberto: o estado (destaque, posição) nasce e morre com ele. */
export function MacMenu<V extends string = string>({ open, ...props }: MacMenuProps<V>) {
  if (!open) return null;
  return <MacMenuPanel {...props} />;
}

function MacMenuPanel<V extends string = string>({
  onClose,
  anchorRef,
  entries,
  onSelect,
  selectedValue,
  role = "menu",
  align = "start",
  id,
  ariaLabel,
  matchAnchorWidth = true,
}: Omit<MacMenuProps<V>, "open">) {
  const generatedId = useId();
  const menuId = id ?? `mac-menu-${generatedId}`;
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  // Destaque inicial: item selecionado ou o primeiro habilitado.
  const [highlighted, setHighlighted] = useState<number>(() => {
    const selectedIndex = entries.findIndex(
      (entry) => isItem(entry) && entry.value === selectedValue && !entry.disabled
    );
    if (selectedIndex >= 0) return selectedIndex;
    return entries.findIndex((entry) => isItem(entry) && !entry.disabled);
  });
  const typeahead = useRef({ text: "", timer: 0 as unknown as ReturnType<typeof setTimeout> });

  const hasCheckmarks = role === "listbox";

  const enabledIndexes = useMemo(
    () =>
      entries
        .map((entry, index) => (isItem(entry) && !entry.disabled ? index : -1))
        .filter((index) => index >= 0),
    [entries]
  );

  // Posiciona o menu abaixo do gatilho; inverte para cima quando falta espaço.
  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const menuW = Math.max(menu?.offsetWidth ?? 0, matchAnchorWidth ? rect.width : 0);
    const menuH = menu?.scrollHeight ?? 0;

    const spaceBelow = viewportH - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
    const placeAbove = menuH > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, placeAbove ? spaceAbove : spaceBelow);
    const renderedH = Math.min(menuH, maxHeight);

    let left = align === "end" ? rect.right - menuW : rect.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), viewportW - menuW - VIEWPORT_MARGIN);

    setPlacement({
      top: placeAbove ? rect.top - ANCHOR_GAP - renderedH : rect.bottom + ANCHOR_GAP,
      left,
      minWidth: matchAnchorWidth ? rect.width : 0,
      maxHeight,
    });
  }, [anchorRef, align, matchAnchorWidth]);

  useLayoutEffect(() => {
    updatePlacement();
    // Segunda passada: agora que o menu existe no DOM, medimos o tamanho real.
    const frame = requestAnimationFrame(updatePlacement);
    return () => cancelAnimationFrame(frame);
  }, [updatePlacement, entries]);

  // Foco no menu ao abrir, para a navegação por teclado funcionar de imediato.
  useEffect(() => {
    menuRef.current?.focus({ preventScroll: true });
  }, []);

  // Mantém o item destacado visível ao navegar pelo teclado.
  useEffect(() => {
    if (highlighted < 0) return;
    const node = menuRef.current?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  // Fecha ao clicar fora, rolar a página ou redimensionar.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose("outside");
    };
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose("outside");
    };
    const handleResize = () => onClose("outside");
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [onClose, anchorRef]);

  const moveHighlight = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return;
    const position = enabledIndexes.indexOf(highlighted);
    const next =
      position === -1
        ? direction === 1
          ? enabledIndexes[0]
          : enabledIndexes[enabledIndexes.length - 1]
        : enabledIndexes[(position + direction + enabledIndexes.length) % enabledIndexes.length];
    setHighlighted(next);
  };

  const activate = (index: number) => {
    const entry = entries[index];
    if (!entry || !isItem(entry) || entry.disabled) return;
    onSelect(entry.value);
    onClose("select");
    if (!entry.href) anchorRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveHighlight(1);
        return;
      case "ArrowUp":
        event.preventDefault();
        moveHighlight(-1);
        return;
      case "Home":
        event.preventDefault();
        setHighlighted(enabledIndexes[0] ?? -1);
        return;
      case "End":
        event.preventDefault();
        setHighlighted(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        return;
      case "Enter":
      case " ": {
        event.preventDefault();
        if (highlighted >= 0) {
          const entry = entries[highlighted];
          if (isItem(entry) && entry.href) {
            menuRef.current
              ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
              ?.click();
            return;
          }
          activate(highlighted);
        }
        return;
      }
      case "Escape":
        event.preventDefault();
        onClose("escape");
        anchorRef.current?.focus({ preventScroll: true });
        return;
      case "Tab":
        onClose("tab");
        return;
      default:
        // Busca por digitação, como nos menus nativos.
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          clearTimeout(typeahead.current.timer);
          typeahead.current.text += event.key.toLocaleLowerCase("pt-BR");
          typeahead.current.timer = setTimeout(() => (typeahead.current.text = ""), 600);
          const match = enabledIndexes.find((index) => {
            const entry = entries[index];
            return (
              isItem(entry) &&
              entry.label.toLocaleLowerCase("pt-BR").startsWith(typeahead.current.text)
            );
          });
          if (match !== undefined) setHighlighted(match);
        }
    }
  };

  const optionRole = role === "listbox" ? "option" : "menuitem";

  return (
    <Portal>
      <div
        ref={menuRef}
        id={menuId}
        role={role}
        aria-label={ariaLabel}
        tabIndex={-1}
        aria-activedescendant={highlighted >= 0 ? `${menuId}-item-${highlighted}` : undefined}
        onKeyDown={handleKeyDown}
        // Portais propagam eventos pela árvore React: sem isso, um clique no
        // menu também acionaria o onClick da linha que contém o gatilho.
        onClick={(event) => event.stopPropagation()}
        className="mac-material-menu mac-menu animate-mac-menu fixed z-[200] overflow-y-auto outline-none isolate"
        style={{
          top: placement?.top ?? -9999,
          left: placement?.left ?? -9999,
          minWidth: placement?.minWidth || undefined,
          maxHeight: placement?.maxHeight,
          maxWidth: "calc(100vw - 16px)",
          // opacity (e não visibility) para o menu já poder receber foco
          // enquanto mede o próprio tamanho no primeiro quadro.
          opacity: placement ? 1 : 0,
          pointerEvents: placement ? undefined : "none",
        }}
      >
        {entries.map((entry, index) => {
          if (entry.type === "separator") {
            return <div key={entry.key ?? `sep-${index}`} role="separator" className="mac-menu-separator" />;
          }
          if (entry.type === "header") {
            return (
              <div key={entry.key ?? `header-${index}`} role="presentation" className="mac-menu-header">
                {entry.label}
              </div>
            );
          }

          const isSelected = hasCheckmarks && entry.value === selectedValue;
          const content = (
            <>
              {hasCheckmarks && (
                <span className="w-3 shrink-0 flex items-center justify-center" aria-hidden>
                  {isSelected && <Check size={12} strokeWidth={3} />}
                </span>
              )}
              {entry.icon && (
                <span className="w-4 shrink-0 flex items-center justify-center" aria-hidden>
                  {entry.icon}
                </span>
              )}
              {entry.subtitle ? (
                <span className="flex-1 min-w-0 py-1">
                  <span className="block truncate whitespace-nowrap">{entry.label}</span>
                  <span className="block truncate whitespace-nowrap text-[11px] leading-[14px] font-normal text-[var(--mac-vibrant-label-secondary)]">
                    {entry.subtitle}
                  </span>
                </span>
              ) : (
                <span className="flex-1 min-w-0 truncate whitespace-nowrap">{entry.label}</span>
              )}
              {entry.shortcut && <span className="mac-menu-shortcut">{entry.shortcut}</span>}
            </>
          );

          const commonProps = {
            id: `${menuId}-item-${index}`,
            role: optionRole,
            "data-index": index,
            "data-highlighted": highlighted === index ? "true" : undefined,
            "aria-disabled": entry.disabled ? true : undefined,
            "aria-selected": role === "listbox" ? isSelected : undefined,
            onPointerMove: () => !entry.disabled && setHighlighted(index),
            onPointerLeave: () => setHighlighted(-1),
            className: "mac-menu-item",
            style: entry.destructive && !entry.disabled ? { color: "var(--mac-red)" } : undefined,
          } as const;

          if (entry.href && !entry.disabled) {
            return (
              <Link
                key={entry.value}
                href={entry.href}
                tabIndex={-1}
                {...commonProps}
                onClick={() => {
                  onSelect(entry.value);
                  onClose("select");
                }}
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={entry.value} {...commonProps} onClick={() => activate(index)}>
              {content}
            </div>
          );
        })}
      </div>
    </Portal>
  );
}
