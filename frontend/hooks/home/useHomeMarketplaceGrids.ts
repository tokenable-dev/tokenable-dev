"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import {
  getAllMarketplaceCollections,
  rq,
  marketplaceRqPolicy,
} from "@/lib/core";
import { useMarketplaceSnapshots } from "@/hooks/home/useMarketplaceSnapshots";
import { useCardhedgerMockCoverImages } from "@/hooks/home/useCardhedgerMockCoverImages";
import { resolveMarketsListingMarketChangePct90d } from "@/lib/markets/marketsListingMarketPrice";
import {
  HOME_MOCK_JUST_VAULTED,
  HOME_MOCK_SNAPSHOT_BY_KEY,
  HOME_MOCK_TICKER_ITEMS,
  HOME_MOCK_TOP_MOVERS,
  shouldUseHomeMockCards,
} from "@/lib/home/homeMockData";
import {
  mockCoverSearchFromCollection,
  withMockCoverImages,
} from "@/lib/home/withMockCoverImages";

export const HOME_TOP_MOVERS_LIMIT = 20;
export const HOME_JUST_VAULTED_LIMIT = 20;

function sortByCreatedAtDesc(
  collections: MarketplaceCollectionSummary[],
): MarketplaceCollectionSummary[] {
  return [...collections].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function useHomeMarketplaceGrids() {
  const { data: allCollections, isPending: collectionsPending } = useQuery({
    queryKey: rq.homeAllCollections(),
    queryFn: getAllMarketplaceCollections,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const collections = allCollections ?? [];
  const useMocks = !collectionsPending && shouldUseHomeMockCards(collections.length);

  const mockCoverQueries = useMemo(() => {
    if (!useMocks) return [];
    return [...HOME_MOCK_TOP_MOVERS, ...HOME_MOCK_JUST_VAULTED].map(
      mockCoverSearchFromCollection,
    );
  }, [useMocks]);

  const { data: coverByKey } = useCardhedgerMockCoverImages(useMocks, mockCoverQueries);
  const covers = coverByKey ?? EMPTY_COVER_MAP;

  const snapshotKeysSorted = useMemo(() => {
    if (useMocks) return [] as string[];
    const u = [...new Set(collections.map((c) => c.collectionKey.toLowerCase()))];
    u.sort();
    return u;
  }, [collections, useMocks]);

  const { snapshotByKey: liveSnapshotByKey, snapshotsPending: liveSnapshotsPending } =
    useMarketplaceSnapshots(snapshotKeysSorted, snapshotKeysSorted.length > 0);

  const snapshotByKey = useMemo(() => {
    if (useMocks) return HOME_MOCK_SNAPSHOT_BY_KEY;
    return liveSnapshotByKey;
  }, [useMocks, liveSnapshotByKey]);

  const topMovers = useMemo(() => {
    if (useMocks) {
      return withMockCoverImages(HOME_MOCK_TOP_MOVERS, covers);
    }
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
  }, [collections, snapshotByKey, useMocks, covers]);

  const justVaulted = useMemo(() => {
    if (useMocks) {
      return withMockCoverImages(HOME_MOCK_JUST_VAULTED, covers);
    }
    return sortByCreatedAtDesc(collections).slice(0, HOME_JUST_VAULTED_LIMIT);
  }, [collections, useMocks, covers]);

  const tickerItems = useMemo(() => {
    if (useMocks) {
      return HOME_MOCK_TICKER_ITEMS.map((item) => ({
        collection: {
          collectionKey: `mock:ticker:${item.name}`,
          displayLabel: item.name,
          queryUsed: null,
          components: { listingDisplayTitle: item.name, cardName: item.name },
          createdAt: new Date().toISOString(),
          activeListingCount: 0,
        } satisfies MarketplaceCollectionSummary,
        changePct: item.changePct,
      }));
    }
    return collections
      .map((c) => {
        const snapshot = snapshotByKey.get(c.collectionKey.toLowerCase());
        const changePct = resolveMarketsListingMarketChangePct90d(snapshot);
        return { collection: c, changePct };
      })
      .filter((row) => row.changePct != null && Number.isFinite(row.changePct))
      .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
      .slice(0, 8);
  }, [collections, snapshotByKey, useMocks]);

  return {
    topMovers,
    justVaulted,
    tickerItems,
    snapshotByKey,
    isPending: collectionsPending,
    snapshotsPending: useMocks ? false : liveSnapshotsPending,
    usingMockCards: useMocks,
  };
}

const EMPTY_COVER_MAP = new Map<string, string>();

export type HomeSnapshotMap = Map<string, CollectionListMarketSnapshot>;
