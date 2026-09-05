"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Card.html `#tk-drawer` — right panel for View all asks / trades.
 */
export function CollectionDetailViewAllDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="cd-viewall-drawer open" id="tk-drawer" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="cd-viewall-drawer__backdrop dw-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="cd-viewall-drawer__panel dw-panel">
        <div className="cd-viewall-drawer__head dw-head">
          <h2 className="cd-viewall-drawer__title">{title}</h2>
          <button
            type="button"
            className="cd-viewall-drawer__close dw-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="cd-viewall-drawer__body dw-body" id="dw-body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
