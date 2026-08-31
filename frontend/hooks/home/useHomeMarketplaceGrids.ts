"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CollectionListMarketSnapshot } from "@/lib/core";
import {
  getHomeMarketplaceFeed,
  rq,
  marketplaceRqPolicy,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { resolveMarketsListingMarketChangePct } from "@/lib/markets/marketsListingMarketPrice";

/** ds-23 wrap grid: 10 on 5-col desktop, 8 from tablet/mobile down (CSS hides 9–10). */
export const HOME_TOP_MOVERS_LIMIT = 10;
export const HOME_JUST_VAULTED_LIMIT = 10;

export function useHomeMarketplaceGrids() {
  const chainId = activeRqChainId();
  const { data, isPending } = useQuery({
    queryKey: rq.homeMarketplaceFeed(chainId),
    queryFn: getHomeMarketplaceFeed,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

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
    isPending,
    snapshotsPending: isPending,
  };
}

export type HomeSnapshotMap = Map<string, CollectionListMarketSnapshot>;
