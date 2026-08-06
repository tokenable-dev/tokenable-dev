"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/ds/cn";

export type TkDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /**
   * When false: no X button, Escape, or backdrop dismiss.
   * Use for required onboarding gates (e.g. partner company address).
   */
  dismissible?: boolean;
};

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TkDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  dismissible = true,
}: TkDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="tk-dialog__overlay"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn("tk-dialog", className)}
      >
        <div className="tk-dialog__head">
          <h2 className="tk-dialog__title" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="tk-dialog__body" id={descId}>
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div className="tk-dialog__body">{children}</div> : null}
        {footer ? <div className="tk-dialog__foot">{footer}</div> : null}
        {dismissible ? (
          <button
            type="button"
            className="tk-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
