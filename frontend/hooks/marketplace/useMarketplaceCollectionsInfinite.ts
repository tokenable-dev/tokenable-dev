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

export function useMarketplaceCollectionsInfinite(opts?: { enabled?: boolean }) {
  const chainId = activeRqChainId();
  return useInfiniteQuery({
    queryKey: [...rq.collectionsMarketplace(chainId), MARKETS_COLLECTIONS_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      getMarketplaceCollectionsPage({
        cursor: pageParam as string | null,
        limit: MARKETS_COLLECTIONS_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: opts?.enabled ?? true,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    // Catalog data is stable; skip the background refetch on tab-focus/reconnect.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });
}
