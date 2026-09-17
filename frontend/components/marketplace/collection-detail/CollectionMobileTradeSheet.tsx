"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Card.html `#tt-sheet` — mobile bottom sheet that hosts `#tk-trade`
 * (Buy / Bid / Sell) when the fixed `#ob-bottom-bar` opens a tab.
 */
export function CollectionMobileTradeSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="cd-mobile-trade-sheet"
      id="tt-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Trade"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cd-mobile-trade-sheet__panel">
        <div className="cd-mobile-trade-sheet__grab" aria-hidden />
        <div className="cd-mobile-trade-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
