"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  type CollectionListMarketSnapshot,
} from "@/lib/core";

/** Batched materialized market snapshots for admin tables (ref / floor / last trade). */
export function useAdminCollectionMarketSnapshots(collectionKeys: readonly string[]) {
  const sortedKeys = useMemo(
    () =>
      [...new Set(collectionKeys.map((k) => k.trim().toLowerCase()).filter(Boolean))].sort(),
    [collectionKeys],
  );

  const query = useQuery({
    queryKey: rq.collectionSnapshots(sortedKeys, "max"),
    queryFn: () => postMarketplaceCollectionSnapshotsBatched(sortedKeys, "max"),
    enabled: sortedKeys.length > 0,
    staleTime: 60_000,
  });

  const byKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const item of query.data?.items ?? []) {
      m.set(item.collectionKey.toLowerCase(), item);
    }
    return m;
  }, [query.data?.items]);

  return { query, byKey, sortedKeys };
}
