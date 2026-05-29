"use client";

import { useEffect, useState } from "react";

/** Viewport at or below `maxWidthPx` (default: below Tailwind `sm`). */
export function useIsMobileViewport(maxWidthPx = 639): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidthPx]);
  return mobile;
}
