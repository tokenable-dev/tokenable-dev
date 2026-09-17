"use client";

import { useEffect, useRef, useState } from "react";

/** Fixed desktop GNB search field width — do not shrink with the viewport. */
export const GNB_SEARCH_BAR_WIDTH_PX = 420;

/** Gap between Markets/Portfolio/Sell (or account) and the search field. */
const GNB_SEARCH_EDGE_GAP_PX = 16;

/**
 * Keeps the 420px search bar viewport-centered when there is room; as the
 * bar narrows, slides it toward the account cluster. When it would hit
 * Markets / Portfolio / Sell, reports `compact` so the header can switch
 * to the mobile magnifier + overlay.
 *
 * `rightRef` must point at the account cluster only (not the fallback icon),
 * so showing the icon does not change the fit measurement.
 */
export function useGnbDesktopSearchLayout(enabled: boolean) {
  const barRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [searchLeftPx, setSearchLeftPx] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCompact(false);
      setSearchLeftPx(null);
      return;
    }

    const bar = barRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!bar || !left || !right) return;

    const measure = () => {
      const barW = bar.clientWidth;
      const leftW = left.offsetWidth;
      const rightW = right.offsetWidth;
      const minLeft = leftW + GNB_SEARCH_EDGE_GAP_PX;
      const maxLeft =
        barW - rightW - GNB_SEARCH_EDGE_GAP_PX - GNB_SEARCH_BAR_WIDTH_PX;

      if (maxLeft < minLeft) {
        setCompact(true);
        setSearchLeftPx(null);
        return;
      }

      const idealLeft = (barW - GNB_SEARCH_BAR_WIDTH_PX) / 2;
      const leftPos = Math.min(Math.max(idealLeft, minLeft), maxLeft);
      setCompact(false);
      setSearchLeftPx(Math.round(leftPos));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    ro.observe(left);
    ro.observe(right);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);

  return { barRef, leftRef, rightRef, compact, searchLeftPx };
}
