"use client";

import { useEffect, useRef } from "react";
import { perfLog } from "@/lib/perf";

type Milestone = "tokenIds" | "assets" | "prices";

/**
 * Client-side portfolio pipeline timing when `localStorage.PERF_LOG=1`.
 * Complements React Query observer (query-level) with business milestones.
 */
export function usePortfolioLoadPerf(input: {
  enabled: boolean;
  tokenIdsCount: number;
  assetsCount: number;
  valuesPending: boolean;
  assetsLoading: boolean;
}) {
  const { enabled, tokenIdsCount, assetsCount, valuesPending, assetsLoading } =
    input;
  const startedRef = useRef<number | null>(null);
  const loggedRef = useRef<Set<Milestone>>(new Set());

  useEffect(() => {
    if (!enabled) {
      startedRef.current = null;
      loggedRef.current = new Set();
      return;
    }
    if (startedRef.current == null) {
      startedRef.current = performance.now();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || startedRef.current == null) return;
    if (tokenIdsCount > 0 && !loggedRef.current.has("tokenIds")) {
      loggedRef.current.add("tokenIds");
      perfLog(
        "portfolio",
        "tokenIds-ready",
        performance.now() - startedRef.current,
        { tokenCount: tokenIdsCount },
      );
    }
  }, [enabled, tokenIdsCount]);

  useEffect(() => {
    if (!enabled || startedRef.current == null) return;
    if (
      assetsCount > 0 &&
      !assetsLoading &&
      !loggedRef.current.has("assets")
    ) {
      loggedRef.current.add("assets");
      perfLog(
        "portfolio",
        "assets-ready",
        performance.now() - startedRef.current,
        { assetCount: assetsCount },
      );
    }
  }, [enabled, assetsCount, assetsLoading]);

  useEffect(() => {
    if (!enabled || startedRef.current == null) return;
    if (
      tokenIdsCount > 0 &&
      assetsCount > 0 &&
      !valuesPending &&
      !loggedRef.current.has("prices")
    ) {
      loggedRef.current.add("prices");
      perfLog(
        "portfolio",
        "prices-ready",
        performance.now() - startedRef.current,
        { tokenCount: tokenIdsCount, assetCount: assetsCount },
      );
    }
  }, [enabled, tokenIdsCount, assetsCount, valuesPending]);
}
