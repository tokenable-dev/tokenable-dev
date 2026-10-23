"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface RwaImageLightboxProps {
  open: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
}

/**
 * Full-screen image preview — tap/click anywhere (image or backdrop) to dismiss.
 */
export function RwaImageLightbox({
  open,
  src,
  alt = "",
  onClose,
}: RwaImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      (document.activeElement as HTMLElement | null)?.blur?.();
    };
  }, [open, onClose]);

  if (!mounted || !open || !src) return null;

  return createPortal(
    <button
      type="button"
      role="dialog"
      aria-modal
      aria-label="Enlarged card image"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex cursor-default items-center justify-center bg-black/88 p-4 backdrop-blur-[2px] sm:p-8"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        className="max-h-[min(85dvh,92vh,1100px)] max-w-[min(92vw,calc(min(85dvh,92vh,1100px)*3/4))] object-contain object-center shadow-[0_28px_80px_-24px_rgba(0,0,0,0.85)]"
        style={{ filter: "saturate(1.04) contrast(1.02)" }}
      />
    </button>,
    document.body,
  );
}
