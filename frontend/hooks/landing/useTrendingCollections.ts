"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";

/**
 * Fetches "max" duration snapshots for the trending collections carousel.
 * Only fires when `enabled` is true (i.e. the parent has no pre-fetched snapshot map).
 * Returns a pre-indexed `Map<collectionKey, snapshot>` for O(1) lookup.
 */
export function useTrendingSnapshots(
  trendingSnapshotKeysSorted: readonly string[],
  enabled: boolean,
) {
  const { data: snapshotPack } = useQuery({
    queryKey: rq.collectionSnapshots(
      trendingSnapshotKeysSorted as string[],
      "max",
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(
        trendingSnapshotKeysSorted as string[],
        "max",
      ),
    enabled,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of snapshotPack?.items ?? []) {
      m.set(it.collectionKey.toLowerCase(), it);
    }
    return m;
  }, [snapshotPack]);

  return { snapshotByKey };
}
