"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionSimilar,
  postMarketplaceCollectionSnapshotsBatched,
  type CollectionListMarketSnapshot,
  type MarketplaceCollectionSummary,
} from "@/lib/core";
import { rq } from "@/lib/core/queryKeys";
import { activeRqChainId } from "@/lib/chains";

export type SimilarCollectionItem = {
  collectionKey: string;
  displayLabel: string;
  imageUrl: string | null;
  lastPriceUsd: number | null;
  changePct: number | null;
};

function pickLastPriceUsd(snap: CollectionListMarketSnapshot | undefined): number | null {
  if (!snap) return null;
  const gp = snap.gradePrices;
  for (const n of [gp?.psa10, gp?.psa9, gp?.raw]) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  }
  const floor = snap.marketStats?.floor;
  if (typeof floor === "number" && Number.isFinite(floor) && floor > 0) return floor;
  const last = snap.lastTokenableTradeUsdc;
  if (typeof last === "number" && Number.isFinite(last) && last > 0) return last;
  return null;
}

function toItems(
  rows: MarketplaceCollectionSummary[],
  snapByKey: Map<string, CollectionListMarketSnapshot>,
): SimilarCollectionItem[] {
  return rows.map((row) => {
    const key = row.collectionKey.toLowerCase();
    const snap = snapByKey.get(key);
    return {
      collectionKey: row.collectionKey,
      displayLabel: row.displayLabel,
      imageUrl: row.displayImageUrl ?? row.coverImageUrl ?? null,
      lastPriceUsd: pickLastPriceUsd(snap),
      changePct:
        snap?.marketChangePct != null && Number.isFinite(snap.marketChangePct)
          ? snap.marketChangePct
          : null,
    };
  });
}

export function useCollectionSimilarItems(collectionKey: string | null | undefined) {
  const chainId = activeRqChainId();
  const key = collectionKey?.trim().toLowerCase() || "";

  return useQuery({
    queryKey: [...rq.collectionDetail(key, chainId), "similar"] as const,
    enabled: Boolean(key),
    staleTime: 60_000,
    queryFn: async () => {
      const similar = await getMarketplaceCollectionSimilar(key);
      const keys = similar.items.map((r) => r.collectionKey.toLowerCase());
      const snaps =
        keys.length > 0
          ? await postMarketplaceCollectionSnapshotsBatched(keys, "365d")
          : { items: [] };
      const snapByKey = new Map(
        snaps.items.map((s) => [s.collectionKey.toLowerCase(), s] as const),
      );
      return { items: toItems(similar.items, snapByKey) };
    },
  });
}
