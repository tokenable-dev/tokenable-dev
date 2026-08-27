"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import {
  getAllMarketplaceCollections,
  rq,
  marketplaceRqPolicy,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { useMarketplaceSnapshots } from "@/hooks/home/useMarketplaceSnapshots";
import { resolveMarketsListingMarketChangePct, resolveMarketsListingMarketChangePct90d } from "@/lib/markets/marketsListingMarketPrice";
import { compareCollectionsByCreatedAtDesc } from "@/lib/markets/marketsCollectionSort";

/** Horizontal carousel — same as Just vaulted. */
export const HOME_TOP_MOVERS_LIMIT = 20;
/** Horizontal carousel (index.html `#grid-vaulted`), including mobile. */
export const HOME_JUST_VAULTED_LIMIT = 20;

function sortByCreatedAtDesc(
  collections: MarketplaceCollectionSummary[],
): MarketplaceCollectionSummary[] {
  return [...collections].sort(compareCollectionsByCreatedAtDesc);
}

export function useHomeMarketplaceGrids() {
  const chainId = activeRqChainId();
  const { data: allCollections, isPending: collectionsPending } = useQuery({
    queryKey: rq.homeAllCollections(chainId),
    queryFn: getAllMarketplaceCollections,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const collections = allCollections ?? [];

  const snapshotKeysSorted = useMemo(() => {
    const u = [...new Set(collections.map((c) => c.collectionKey.toLowerCase()))];
    u.sort();
    return u;
  }, [collections]);

  const { snapshotByKey, snapshotsPending } = useMarketplaceSnapshots(
    snapshotKeysSorted,
    snapshotKeysSorted.length > 0,
  );

  const topMovers = useMemo(() => {
    const ranked = collections
      .map((c) => ({
        collection: c,
        changePct: resolveMarketsListingMarketChangePct90d(
          snapshotByKey.get(c.collectionKey.toLowerCase()),
        ),
      }))
      .filter(
        (row) =>
          row.changePct != null &&
          Number.isFinite(row.changePct) &&
          row.changePct > 0,
      )
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0));
    return ranked.slice(0, HOME_TOP_MOVERS_LIMIT).map((r) => r.collection);
  }, [collections, snapshotByKey]);

  const justVaulted = useMemo(
    () => sortByCreatedAtDesc(collections).slice(0, HOME_JUST_VAULTED_LIMIT),
    [collections],
  );

  const tickerItems = useMemo(
    () =>
      collections
        .map((c) => {
          const snapshot = snapshotByKey.get(c.collectionKey.toLowerCase());
          /* Same 1Y / best-window reference % as collection detail + Markets cards. */
          const changePct = resolveMarketsListingMarketChangePct(snapshot);
          return { collection: c, changePct };
        })
        .filter((row) => row.changePct != null && Number.isFinite(row.changePct))
        .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
        .slice(0, 8),
    [collections, snapshotByKey],
  );

  return {
    topMovers,
    justVaulted,
    tickerItems,
    snapshotByKey,
    isPending: collectionsPending,
    snapshotsPending,
  };
}

export type HomeSnapshotMap = Map<string, CollectionListMarketSnapshot>;
