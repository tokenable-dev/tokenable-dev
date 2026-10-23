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
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { sealedBoxHeroSetTitle } from "@/lib/marketplace/buildCollectionMarketDetailCards";
import {
  buildMarketsCollectionTileGrade,
  buildMarketsCollectionTitle,
} from "@/lib/markets/marketsCollectionTitle";

export type SimilarCollectionItem = {
  collectionKey: string;
  displayLabel: string;
  gradeLabel: string;
  catalogLabel: string;
  components: CollectionComponents;
  imageUrl: string | null;
  lastPriceUsd: number | null;
  changePct: number | null;
};

function loosePriceUsd(comp: CollectionComponents): number | null {
  const cents = comp.loosePriceCents;
  if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
    return cents / 100;
  }
  return null;
}

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
    const comp = row.components ?? {};
    const sealedBox = comp.assetKind === "sealed_box";
    return {
      collectionKey: row.collectionKey,
      // Sealed: set name only (no Booster Box second line); wrap up to 2 lines in CSS.
      displayLabel: sealedBox
        ? sealedBoxHeroSetTitle(comp)
        : buildMarketsCollectionTitle(
            {
              collection: row,
              comp,
            },
            { splitGradeToSecondLine: true },
          ),
      gradeLabel: sealedBox
        ? ""
        : buildMarketsCollectionTileGrade({ comp }),
      catalogLabel: row.displayLabel,
      components: row.components,
      imageUrl: row.displayImageUrl ?? row.coverImageUrl ?? null,
      lastPriceUsd: pickLastPriceUsd(snap) ?? loosePriceUsd(row.components),
      changePct:
        snap?.marketChangePct != null && Number.isFinite(snap.marketChangePct)
          ? snap.marketChangePct
          : null,
    };
  });
}

const SIMILAR_ITEMS_LIMIT = 5;

export function useCollectionSimilarItems(collectionKey: string | null | undefined) {
  const chainId = activeRqChainId();
  const key = collectionKey?.trim().toLowerCase() || "";

  return useQuery({
    queryKey: [...rq.collectionDetail(key, chainId), "similar", SIMILAR_ITEMS_LIMIT] as const,
    enabled: Boolean(key),
    staleTime: 60_000,
    queryFn: async () => {
      const similar = await getMarketplaceCollectionSimilar(key);
      const rows = similar.items.slice(0, SIMILAR_ITEMS_LIMIT);
      const keys = rows.map((r) => r.collectionKey.toLowerCase());
      const snaps =
        keys.length > 0
          ? await postMarketplaceCollectionSnapshotsBatched(keys, "365d")
          : { items: [] };
      const snapByKey = new Map(
        snaps.items.map((s) => [s.collectionKey.toLowerCase(), s] as const),
      );
      return { items: toItems(rows, snapByKey) };
    },
  });
}
