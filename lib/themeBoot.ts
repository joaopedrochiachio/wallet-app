/**
 * Constantes do tema (sem "use client", para o layout do servidor usar o script).
 */
export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "wallet_theme";
export const THEME_EVENT = "wallet-theme-change";
export const THEME_COLORS: Record<AppTheme, string> = { light: "#F2F2F7", dark: "#000000" };

/** Script inline (layout) que aplica o tema salvo antes da hidratação. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"){document.documentElement.classList.add("theme-dark");document.documentElement.style.colorScheme="dark";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","${THEME_COLORS.dark}");}}catch(e){}})();`;
