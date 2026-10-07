"use client";

import { useEffect, useState } from "react";
import { useModalScrollLock } from "@/hooks/ui/useModalScrollLock";

/** Client mount + scroll lock + Escape for collection cover lightboxes. */
export function useCollectionCoverLightboxPortal(open: boolean, onClose: () => void) {
  const [mounted, setMounted] = useState(false);

  useModalScrollLock(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return mounted;
}
