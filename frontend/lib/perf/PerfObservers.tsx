"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryCacheNotifyEvent } from "@tanstack/react-query";
import { PERF_ENABLED, PERF_THRESHOLD_MS, perfLog } from ".";

// Module-level map so it survives React re-renders without setState cost.
// Maps queryHash → fetch start timestamp (ms).
const pendingQueries = new Map<string, number>();

// ─── React Query observer ───────────────────────────────────────────────────

function useQueryPerfObserver(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!PERF_ENABLED) return;

    const cache = queryClient.getQueryCache();
    const unsubscribe = cache.subscribe((event: QueryCacheNotifyEvent) => {
      if (event.type !== "updated") return;

      const action = (event as { action?: { type?: string } }).action;
      if (!action) return;

      if (action.type === "fetch") {
        pendingQueries.set(event.query.queryHash, performance.now());
      } else if (action.type === "success" || action.type === "error") {
        const start = pendingQueries.get(event.query.queryHash);
        if (start !== undefined) {
          pendingQueries.delete(event.query.queryHash);
          const ms = performance.now() - start;
          // Use the first segment of the query key as the label.
          const key = event.query.queryKey;
          const label = Array.isArray(key) ? String(key[0] ?? "unknown") : "unknown";
          perfLog("query", label, ms, {
            status: action.type,
            keyLen: Array.isArray(key) ? key.length : 0,
          });
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);
}

// ─── Route transition observer ───────────────────────────────────────────────

function useRoutePerfObserver(): void {
  const pathname = usePathname();
  const prevPath = useRef<string>(pathname);
  const navStart = useRef<number | null>(null);

  // Capture nav start on any anchor click before Next.js handles it.
  useEffect(() => {
    if (!PERF_ENABLED) return;

    const onLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      try {
        const href = new URL(anchor.href, window.location.href);
        if (href.origin === window.location.origin && href.pathname !== pathname) {
          navStart.current = performance.now();
        }
      } catch {
        // invalid href — ignore
      }
    };

    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  // pathname intentionally excluded — we only attach once and read it via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record transition end when the new pathname commits.
  useEffect(() => {
    if (!PERF_ENABLED) return;
    if (pathname === prevPath.current) return;

    const start = navStart.current;
    if (start !== null) {
      const ms = performance.now() - start;
      perfLog("route", pathname, ms, { from: prevPath.current });
      navStart.current = null;
    }

    prevPath.current = pathname;
  }, [pathname]);
}

// ─── Initial page load (Navigation Timing API) ──────────────────────────────

function usePageLoadObserver(): void {
  useEffect(() => {
    if (!PERF_ENABLED || typeof window === "undefined") return;

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const nav = entry as PerformanceNavigationTiming;
          const loadMs = nav.loadEventEnd - nav.fetchStart;
          if (loadMs > 0) {
            perfLog("page", "initial-load", loadMs, {
              ttfb: +(nav.responseStart - nav.fetchStart).toFixed(2),
              domContentLoaded: +(
                nav.domContentLoadedEventEnd - nav.fetchStart
              ).toFixed(2),
            }, 0 /* always log the initial load if perf enabled */);
          }
        }
      });
      // buffered: true captures entries that fired before observer mounted.
      observer.observe({ type: "navigation", buffered: true });
    } catch {
      // PerformanceObserver unavailable (old browsers / jsdom) — skip silently.
    }

    return () => observer?.disconnect();
  }, []);
}

// ─── Composite component ─────────────────────────────────────────────────────

/**
 * Null-rendering component. Mount once inside `QueryClientProvider`.
 * Registers all perf observers only when `PERF_ENABLED` is true.
 */
export function PerfObservers(): null {
  useQueryPerfObserver();
  useRoutePerfObserver();
  usePageLoadObserver();
  return null;
}
