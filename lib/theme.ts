"use client";

import { useSyncExternalStore } from "react";

/**
 * Tema do app escolhido pela pessoa: tudo claro ou tudo escuro.
 * A escolha fica no aparelho (localStorage) e é aplicada antes da primeira
 * pintura pelo script de THEME_BOOT_SCRIPT no layout, sem piscar.
 */
import { THEME_COLORS, THEME_EVENT, THEME_STORAGE_KEY, type AppTheme } from "./themeBoot";

export type { AppTheme };

function readTheme(): AppTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("theme-dark") ? "dark" : "light";
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.toggle("theme-dark", theme === "dark");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* modo privado: o tema vale só nesta sessão */
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      document.documentElement.classList.toggle("theme-dark", e.newValue === "dark");
      callback();
    }
  };
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppTheme(): [AppTheme, (theme: AppTheme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as AppTheme);
  return [theme, applyTheme];
}
