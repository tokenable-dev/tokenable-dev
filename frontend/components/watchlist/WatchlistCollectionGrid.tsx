"use client";

import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";
import { WatchlistCollectibleCard } from "./WatchlistCollectibleCard";

export function WatchlistCollectionGrid({
  collections,
  snapshotByKey,
  resolvedCoverMap,
  changeLoading = false,
}: {
  collections: MarketplaceCollectionSummary[];
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
  resolvedCoverMap: Map<string, string>;
  changeLoading?: boolean;
}) {
  return (
    <div className="watchlist-grid">
      {collections.map((collection) => {
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
        return (
          <WatchlistCollectibleCard
            key={collection.collectionKey}
            collection={collection}
            snapshot={snapshotByKey.get(collectionKeyLower(collection))}
            resolvedCoverUrl={
              displayImageUrl ? resolvedCoverMap.get(displayImageUrl) : undefined
            }
            changeLoading={changeLoading}
          />
        );
      })}
    </div>
  );
}
