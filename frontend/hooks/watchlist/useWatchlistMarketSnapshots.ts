"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";
import { useWatchlist } from "@/hooks/watchlist/useWatchlist";

export function useWatchlistMarketSnapshots() {
  const { data, isLoading, isError } = useWatchlist();
  const keys = useMemo(
    () => (data?.collectionKeys ?? []).slice().sort(),
    [data?.collectionKeys],
  );

  const snapshotsQuery = useQuery({
    queryKey: rq.collectionSnapshots(keys, "max"),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(keys, "max"),
    enabled: keys.length > 0,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const item of snapshotsQuery.data?.items ?? []) {
      m.set(item.collectionKey.toLowerCase(), item);
    }
    return m;
  }, [snapshotsQuery.data?.items]);

  return {
    items: data?.items ?? [],
    isLoading: isLoading || (keys.length > 0 && snapshotsQuery.isLoading),
    isError: isError || snapshotsQuery.isError,
    snapshotByKey,
  };
}
