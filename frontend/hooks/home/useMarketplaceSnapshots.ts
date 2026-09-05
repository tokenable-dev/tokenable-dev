"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";

/** Batched collection snapshots for home grids and other marketplace lists. */
export function useMarketplaceSnapshots(
  collectionKeysSorted: readonly string[],
  enabled: boolean,
) {
  const { data: snapshotPack, isPending: snapshotsPending } = useQuery({
    queryKey: rq.collectionSnapshots(collectionKeysSorted as string[], "max"),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(collectionKeysSorted as string[], "max"),
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

  return { snapshotByKey, snapshotsPending };
}
