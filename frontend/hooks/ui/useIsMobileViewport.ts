"use client";

import { useEffect, useState } from "react";

/** Viewport match + whether `matchMedia` has been read (avoids SSR/hydration false → true races). */
export function useMobileViewport(maxWidthPx = 639): {
  ready: boolean;
  isMobile: boolean;
} {
  const [state, setState] = useState({ ready: false, isMobile: false });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setState({ ready: true, isMobile: mq.matches });
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [maxWidthPx]);
  return state;
}

/** Viewport at or below `maxWidthPx` (default: below Tailwind `sm`). */
export function useIsMobileViewport(maxWidthPx = 639): boolean {
  return useMobileViewport(maxWidthPx).isMobile;
}
