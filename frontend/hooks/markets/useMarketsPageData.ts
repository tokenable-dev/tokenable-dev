"use client";

import { useMemo, useRef } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
  type MarketplaceCollectionSummary,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { MARKET_PRICE_CHANGE_SNAPSHOT_DURATION } from "@/lib/market";
import {
  collectionKeyLower,
  compareMarketsCollections,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";

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
    refetchIntervalInBackground: false,
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
 *
 * Infinite scroll grows the key list; `keepPreviousData` keeps existing
 * card stats visible while the next batch resolves.
 */
export function useMarketsSnapshots(
  snapshotKeysSorted: readonly string[],
  enabled: boolean,
) {
  const { data: snapshotPack, isPending, isFetching } = useQuery({
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
    placeholderData: keepPreviousData,
  });

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      const k = it.collectionKey?.trim().toLowerCase();
      if (k) m.set(k, it);
    }
    return m;
  }, [snapshotPack]);

  return {
    snapshotByKey,
    /** First paint only — not true while a later page's snapshots are fetching. */
    isPending: isPending && snapshotByKey.size === 0,
    isFetching,
  };
}

/**
 * Avoid reshuffling already-visible cards while the next page's snapshots load.
 * Newcomers append at the bottom; a full re-sort runs once fetching settles.
 */
export function useMarketsStableSortedCollections(
  collections: readonly MarketplaceCollectionSummary[],
  snapshotByKey: Map<string, CollectionListMarketSnapshot>,
  sortId: MarketsSortId,
  snapshotsFetching: boolean,
): MarketplaceCollectionSummary[] {
  const heldRef = useRef<MarketplaceCollectionSummary[]>([]);
  const sortIdRef = useRef(sortId);

  return useMemo(() => {
    const live = [...collections].sort((a, b) =>
      compareMarketsCollections(a, b, sortId, snapshotByKey),
    );

    const sortChanged = sortIdRef.current !== sortId;
    sortIdRef.current = sortId;

    if (sortChanged || !snapshotsFetching || heldRef.current.length === 0) {
      heldRef.current = live;
      return live;
    }

    const heldKeys = new Set(
      heldRef.current.map((c) => collectionKeyLower(c)).filter(Boolean),
    );
    const newcomers = collections.filter((c) => {
      const k = collectionKeyLower(c);
      return k.length > 0 && !heldKeys.has(k);
    });
    if (newcomers.length === 0) return heldRef.current;

    const next = [...heldRef.current, ...newcomers];
    heldRef.current = next;
    return next;
  }, [collections, snapshotByKey, sortId, snapshotsFetching]);
}
