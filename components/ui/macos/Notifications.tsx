"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Portal } from "../Portal";

/**
 * Notifications — macOS 27 (Figma: página "Notifications")
 *
 * Banner de 344px com vidro (raio 20px), ícone do app 32px, título 13px bold,
 * mensagem 13px regular e o horário ("agora") em 11px terciário à direita.
 * No desktop entra pelo canto superior direito; no celular, pelo topo.
 * Substitui os window.alert() do app, que travavam a tela.
 */

export type NotificationTone = "info" | "success" | "warning" | "error";

export interface NotifyOptions {
  title?: string;
  message: string;
  tone?: NotificationTone;
  /** Em ms. Erros ficam mais tempo na tela. */
  duration?: number;
}

type NotificationRecord = Required<Omit<NotifyOptions, "duration">> & {
  id: number;
  duration: number;
};

type NotifyFn = ((options: NotifyOptions | string) => void) & {
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const DEFAULT_TITLES: Record<NotificationTone, string> = {
  info: "Wallet",
  success: "Pronto",
  warning: "Atenção",
  error: "Algo deu errado",
};

const MAX_VISIBLE = 3;

const NotificationContext = createContext<NotifyFn | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useMemo(() => {
    const push = (options: NotifyOptions | string) => {
      const normalized = typeof options === "string" ? { message: options } : options;
      const tone = normalized.tone ?? "info";
      const record: NotificationRecord = {
        id: nextId.current++,
        tone,
        title: normalized.title ?? DEFAULT_TITLES[tone],
        message: normalized.message,
        duration: normalized.duration ?? (tone === "error" ? 7000 : 4500),
      };
      setItems((prev) => [record, ...prev].slice(0, MAX_VISIBLE));
    };
    const fn = push as NotifyFn;
    fn.error = (message, title) => push({ message, title, tone: "error" });
    fn.success = (message, title) => push({ message, title, tone: "success" });
    fn.warning = (message, title) => push({ message, title, tone: "warning" });
    fn.info = (message, title) => push({ message, title, tone: "info" });
    return fn;
  }, []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Portal>
        <div
          className="fixed z-[300] top-[calc(env(safe-area-inset-top,0px)+8px)] inset-x-2 md:inset-x-auto md:right-4 md:top-4 flex flex-col items-center md:items-end gap-4 pointer-events-none"
          aria-live="polite"
        >
          {items.map((item) => (
            <NotificationBanner key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>
      </Portal>
    </NotificationContext.Provider>
  );
}

function NotificationBanner({
  item,
  onDismiss,
}: {
  item: NotificationRecord;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(timer);
  }, [paused, item.duration, onDismiss]);

  const isUrgent = item.tone === "error" || item.tone === "warning";

  return (
    <div
      role={isUrgent ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={onDismiss}
      className="group mac-material-notification animate-mac-notification pointer-events-auto relative flex w-full max-w-[344px] items-start gap-2 py-3 pl-2.5 pr-3.5"
    >
      {/* Fechar: aparece no hover, no canto superior esquerdo, como no macOS */}
      <button
        type="button"
        aria-label="Fechar notificação"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
        className="mac-material-notification absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center !rounded-full text-mac-label-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <X size={10} strokeWidth={3} />
      </button>

      <div className="flex items-center self-stretch px-1">
        <Image
          src="/brand/wallet-icon.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-[7px] object-contain"
        />
      </div>

      <div className="min-w-0 flex-1 text-[13px] leading-4 text-[var(--mac-vibrant-label-primary)]">
        <p className="truncate font-bold tracking-[-0.26px]">
          {item.tone === "error" && (
            <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-mac-red align-middle" aria-hidden />
          )}
          {item.title}
        </p>
        <p className="font-normal tracking-[-0.104px] break-words">{item.message}</p>
      </div>

      <p className="shrink-0 text-right text-[11px] leading-[14px] text-[var(--mac-vibrant-label-tertiary)]">
        agora
      </p>
    </div>
  );
}

/**
 * Fora do NotificationProvider (telas montadas isoladamente, como nos testes),
 * cai para o window.alert antigo em vez de quebrar a tela.
 */
const fallbackNotify: NotifyFn = (() => {
  const push = (options: NotifyOptions | string) => {
    const message = typeof options === "string" ? options : options.message;
    if (typeof window !== "undefined") window.alert(message);
  };
  const fn = push as NotifyFn;
  fn.error = (message) => push(message);
  fn.success = (message) => push(message);
  fn.warning = (message) => push(message);
  fn.info = (message) => push(message);
  return fn;
})();

/** Dispara notificações no padrão macOS. O NotificationProvider já está no AppShell. */
export function useNotify(): NotifyFn {
  return useContext(NotificationContext) ?? fallbackNotify;
}
