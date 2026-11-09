"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Portal } from "../ui/Portal";

interface ChatDialogProps {
  children: ReactNode;
  showHistory: boolean;
  onClose: () => void;
}

export function ChatDialog(props: ChatDialogProps) {
  return <Portal><ChatDialogSurface {...props} /></Portal>;
}

function ChatDialogSurface({ children, showHistory, onClose }: ChatDialogProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const element = viewportRef.current;
      if (!element) return;
      element.style.height = `${viewport?.height ?? window.innerHeight}px`;
      element.style.top = `${viewport?.offsetTop ?? 0}px`;
      element.style.width = `${viewport?.width ?? window.innerWidth}px`;
      element.style.left = `${viewport?.offsetLeft ?? 0}px`;
    };
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    const previousFocus = document.activeElement;
    const main = document.querySelector("main");
    const bodyOverflow = document.body.style.overflow;
    const mainOverflow = main?.style.overflow;
    document.body.style.overflow = "hidden";
    if (main) main.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      document.body.style.overflow = bodyOverflow;
      if (main) main.style.overflow = mainOverflow || "";
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.matches("input, textarea, select")) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div ref={viewportRef} data-testid="ai-chat-viewport" className="fixed left-0 top-0 z-[130] flex h-dvh w-full min-w-0 items-end justify-center overscroll-none pt-[env(safe-area-inset-top,0px)] sm:items-center sm:p-5">
      <button type="button" tabIndex={-1} aria-label="Fechar Chat com a IA" onClick={onClose} className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-md" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Chat com a IA Wallet+"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]'
          )).filter((element) => element.getClientRects().length > 0);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (!first) { event.preventDefault(); return; }
          if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
            event.preventDefault(); last.focus();
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
            event.preventDefault(); first.focus();
          }
        }}
        className={`relative z-10 flex h-full max-h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-t-[24px] border border-white/60 bg-[#F5F5F7] shadow-[0_32px_90px_rgba(0,0,0,0.28)] outline-none sm:h-[86%] sm:max-h-[820px] sm:rounded-[32px] ${showHistory ? "sm:max-w-4xl" : "sm:max-w-2xl"}`}
      >
        {children}
      </section>
    </div>
  );
}
