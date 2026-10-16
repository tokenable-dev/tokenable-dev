"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMarketplaceCollectionsPage,
  getMarketplaceMarketsBootstrapPage,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { MARKET_PRICE_CHANGE_SNAPSHOT_DURATION } from "@/lib/market";

/**
 * First Markets grid page. Further pages use the same size via infinite scroll.
 */
export const MARKETS_COLLECTIONS_PAGE_SIZE = 50;

/** Matches backend `searchSummaries` cap. */
const SEARCH_PAGE_SIZE = 40;

export function useMarketplaceCollectionsInfinite(opts?: {
  enabled?: boolean;
  /** Server-side collection text search (`GET …/collections?q=`). */
  q?: string | null;
}) {
  const chainId = activeRqChainId();
  const queryClient = useQueryClient();
  const q = String(opts?.q ?? "").trim();
  const isSearch = q.length > 0;

  return useInfiniteQuery({
    queryKey: isSearch
      ? rq.collectionsSearch(chainId, q)
      : [...rq.collectionsMarketplace(chainId), MARKETS_COLLECTIONS_PAGE_SIZE],
    queryFn: async ({ pageParam }) => {
      const cursor = isSearch ? undefined : (pageParam as string | null);
      if (!isSearch && cursor == null) {
        const boot = await getMarketplaceMarketsBootstrapPage({
          limit: MARKETS_COLLECTIONS_PAGE_SIZE,
          priceHistoryDuration: MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
        });
        const keys = [
          ...new Set(
            boot.items
              .map((c) => c.collectionKey?.trim().toLowerCase())
              .filter((k): k is string => Boolean(k)),
          ),
        ].sort();
        if (keys.length > 0 && boot.snapshots.items.length > 0) {
          queryClient.setQueryData(
            rq.collectionSnapshots(
              chainId,
              keys,
              MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
            ),
            { items: boot.snapshots.items },
          );
        }
        return {
          items: boot.items,
          nextCursor: boot.nextCursor,
        };
      }
      const pack = await getMarketplaceCollectionsPage({
        q: isSearch ? q : undefined,
        cursor,
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
