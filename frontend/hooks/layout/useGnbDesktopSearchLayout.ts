"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Fixed desktop GNB search field width — do not shrink with the viewport. */
export const GNB_SEARCH_BAR_WIDTH_PX = 420;

/** Gap between nav / account chrome and the search field — keep generous to avoid overlap. */
const GNB_SEARCH_EDGE_GAP_PX = 24;

/** Extra slack before we treat the bar as “fits” (subpixel / font load). */
const GNB_SEARCH_FIT_SLACK_PX = 8;

/**
 * Keeps the 420px search bar viewport-centered when there is room; as the
 * bar narrows, slides it toward the account cluster. When it would hit
 * Markets / Portfolio / Sell, reports `compact` so the header can switch
 * to the mobile magnifier + overlay.
 *
 * `measureRightRef` must wrap `.gnb-right` only (auth cluster). Do not include
 * `.gnb-search-desktop-fallback` — counting the magnifier shrinks “available”
 * and can leave desktop stuck in compact mode on wide viewports.
 */
export function useGnbDesktopSearchLayout(enabled: boolean) {
  const barRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const measureRightRef = useRef<HTMLDivElement>(null);
  /** Prefer the search bar on desktop until measure proves it cannot fit. */
  const [compact, setCompact] = useState(false);
  const [searchLeftPx, setSearchLeftPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setCompact(false);
      setSearchLeftPx(null);
      return;
    }

    const bar = barRef.current;
    const left = leftRef.current;
    const right = measureRightRef.current;
    if (!bar || !left || !right) return;

    const measure = () => {
      const barRect = bar.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      const minLeft = leftRect.right - barRect.left + GNB_SEARCH_EDGE_GAP_PX;
      const maxLeft =
        rightRect.left -
        barRect.left -
        GNB_SEARCH_EDGE_GAP_PX -
        GNB_SEARCH_BAR_WIDTH_PX;

      const available =
        rightRect.left - leftRect.right - 2 * GNB_SEARCH_EDGE_GAP_PX;

      if (
        available + GNB_SEARCH_FIT_SLACK_PX < GNB_SEARCH_BAR_WIDTH_PX ||
        maxLeft < minLeft
      ) {
        setCompact(true);
        setSearchLeftPx(null);
        return;
      }

      const idealLeft = (barRect.width - GNB_SEARCH_BAR_WIDTH_PX) / 2;
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

  return { barRef, leftRef, measureRightRef, compact, searchLeftPx };
}
