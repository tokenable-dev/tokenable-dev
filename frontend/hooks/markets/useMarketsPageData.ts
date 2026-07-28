"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { MARKET_PRICE_CHANGE_SNAPSHOT_DURATION } from "@/lib/market";

/**
 * Active orders for the Markets page.
 * Owns the refetch interval and stale policy for the order book.
 */
export function useMarketsOrders() {
  const chainId = activeRqChainId();
  const query = useQuery({
    queryKey: rq.ordersActive(chainId),
    queryFn: getActiveOrders,
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });
  return {
    orders: query.data ?? [],
    /** True until the first fetch settles — unlike isLoading, also true before fetch starts. */
    isPending: query.isPending,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  };
}

/**
 * Market price-change snapshots for a sorted set of collection keys.
 * `enabled` should be `false` while the collection list is still loading.
 * Returns a pre-indexed `Map<collectionKey, snapshot>` for O(1) lookup.
 */
export function useMarketsSnapshots(
  snapshotKeysSorted: readonly string[],
  enabled: boolean,
) {
  const { data: snapshotPack, isPending } = useQuery({
    queryKey: rq.collectionSnapshots(
      snapshotKeysSorted as string[],
      MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(
        snapshotKeysSorted as string[],
        MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
      ),
    enabled: snapshotKeysSorted.length > 0 && enabled,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      const k = it.collectionKey?.trim().toLowerCase();
      if (k) m.set(k, it);
    }
    return m;
  }, [snapshotPack]);

  return { snapshotByKey, isPending };
}
