"use client";

import { useSyncExternalStore, ReactNode } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

export function Portal({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
