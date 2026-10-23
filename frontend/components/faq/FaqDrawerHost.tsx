"use client";

import { useCallback, useEffect, useState } from "react";
import { FaqDrawer } from "./FaqDrawer";
import "@/styles/tokenable-faq.css";

/**
 * Host for `tk-faq-drawer.js` behavior: any `[data-faq-open]` click opens the
 * FAQ bottom drawer (and prevents navigation). `href="/faq"` remains the no-JS fallback.
 */
export function FaqDrawerHost() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest("[data-faq-open]");
      if (!trigger) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return <FaqDrawer open={open} onClose={close} />;
}
