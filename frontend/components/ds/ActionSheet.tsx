"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ds/cn";

export type TkActionSheetProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

function CloseIcon() {
  return (
    <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
      ×
    </span>
  );
}

export function TkActionSheet({
  open,
  onClose,
  children,
  actions,
  className,
  "aria-label": ariaLabel = "Action panel",
}: TkActionSheetProps) {
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
    <div
      className="tk-sheet-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn("tk-sheet-panel", className)}
        data-open=""
      >
        <div className="tk-sheet-handle" aria-hidden />
        <div className="tk-sheet-content">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 32,
              height: 32,
              border: 0,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
            }}
          >
            <CloseIcon />
          </button>
          {children}
        </div>
        {actions ? <div className="tk-sheet-actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
