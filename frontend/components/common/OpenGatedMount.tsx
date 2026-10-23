"use client";

import type { ReactNode } from "react";

/**
 * Renders `children` only when `open` is true.
 *
 * Do not wrap hook-heavy modal bodies — keep wallet hooks in a component that
 * always calls the same hooks and returns null when `open` is false instead.
 */
export function OpenGatedMount({
  open = true,
  children,
}: {
  open?: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return children;
}

/** Block backdrop / Escape dismiss while a wallet flow is in flight. */
export function guardCloseWhileBusy(
  busy: boolean,
  onClose: () => void,
): () => void {
  return () => {
    if (!busy) onClose();
  };
}
