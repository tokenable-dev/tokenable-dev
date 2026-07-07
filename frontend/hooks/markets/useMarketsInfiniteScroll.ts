"use client";

import { useEffect } from "react";

/** Markets.html — scroll sentinel loads next catalog page when near viewport. */
export function useMarketsInfiniteScroll(opts: {
  sentinelRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  rootMargin?: string;
}) {
  const {
    sentinelRef,
    enabled,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    rootMargin = "600px",
  } = opts;

  useEffect(() => {
    if (!enabled || !hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || isFetchingNextPage) return;
        fetchNextPage();
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, hasNextPage, isFetchingNextPage, fetchNextPage, rootMargin, sentinelRef]);
}
