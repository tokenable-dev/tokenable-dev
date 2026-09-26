"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CollectionListMarketSnapshot } from "@/lib/core";
import {
  getHomeMarketplaceFeed,
  rq,
  marketplaceRqPolicy,
} from "@/lib/core";
import type { SupportedChainId } from "@/lib/chains";
import { resolveMarketsListingMarketChangePct } from "@/lib/markets/marketsListingMarketPrice";
import { useAppChain } from "@/providers/AppChainProvider";

export function useHomeMarketplaceGrids() {
  const { chainId, chainReady } = useAppChain();
  const { data, isPending, isFetching, isError } = useQuery({
    queryKey: rq.homeMarketplaceFeed(chainId),
    queryFn: () => getHomeMarketplaceFeed(chainId),
    enabled: chainReady,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const gridsPending =
    !chainReady || (isPending && data === undefined) || (isFetching && data === undefined);

  const snapshotByKey = useMemo(() => {
    const m = new Map<string, CollectionListMarketSnapshot>();
    for (const it of data?.snapshots ?? []) {
      m.set(it.collectionKey.toLowerCase(), it);
    }
    return m;
  }, [data]);

  const tickerItems = useMemo(
    () =>
      (data?.ticker ?? []).map((collection) => ({
        collection,
        changePct: resolveMarketsListingMarketChangePct(
          snapshotByKey.get(collection.collectionKey.toLowerCase()),
        ),
      })),
    [data?.ticker, snapshotByKey],
  );

  return {
    topMovers: data?.topMovers ?? [],
    justVaulted: data?.justVaulted ?? [],
    tickerItems,
    snapshotByKey,
    isPending: gridsPending,
    snapshotsPending: gridsPending,
    isError,
  };
}
