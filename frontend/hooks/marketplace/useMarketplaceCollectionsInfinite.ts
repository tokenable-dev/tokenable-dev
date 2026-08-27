"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionsPage,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

/**
 * First paint ≈ 5 rows on the desktop Markets grid (4 columns).
 * Mobile (2 columns) shows ~10 cards; further pages load via infinite scroll.
 */
export const MARKETS_COLLECTIONS_PAGE_SIZE = 20;

/** Matches backend `searchSummaries` cap. */
const SEARCH_PAGE_SIZE = 40;

export function useMarketplaceCollectionsInfinite(opts?: {
  enabled?: boolean;
  /** Server-side collection text search (`GET …/collections?q=`). */
  q?: string | null;
}) {
  const chainId = activeRqChainId();
  const q = String(opts?.q ?? "").trim();
  const isSearch = q.length > 0;

  return useInfiniteQuery({
    queryKey: isSearch
      ? rq.collectionsSearch(chainId, q)
      : [...rq.collectionsMarketplace(chainId), MARKETS_COLLECTIONS_PAGE_SIZE],
    queryFn: async ({ pageParam }) => {
      const pack = await getMarketplaceCollectionsPage({
        q: isSearch ? q : undefined,
        cursor: isSearch ? undefined : (pageParam as string | null),
        limit: isSearch ? SEARCH_PAGE_SIZE : MARKETS_COLLECTIONS_PAGE_SIZE,
      });
      return {
        items: Array.isArray(pack?.items) ? pack.items.filter(Boolean) : [],
        nextCursor: pack?.nextCursor ?? null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      isSearch ? undefined : (last?.nextCursor ?? undefined),
    enabled: opts?.enabled ?? true,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });
}
