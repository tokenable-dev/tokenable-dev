"use client";

import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { CollectibleCard } from "@/components/collectibles/CollectibleCard";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";

export function MarketsCollectionGrid({
  collections,
  snapshotByKey,
  resolvedCoverMap,
  changeLoading = false,
  onBeforeNavigate,
}: {
  collections: MarketplaceCollectionSummary[];
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
  resolvedCoverMap: Map<string, string>;
  changeLoading?: boolean;
  onBeforeNavigate?: () => void;
}) {
  return (
    <div className="markets-grid">
      {collections.map((collection) => {
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
        return (
          <CollectibleCard
            key={collection.collectionKey}
            collection={collection}
            snapshot={snapshotByKey.get(collectionKeyLower(collection))}
            resolvedCoverUrl={
              displayImageUrl ? resolvedCoverMap.get(displayImageUrl) : undefined
            }
            changeLoading={changeLoading}
            onBeforeNavigate={onBeforeNavigate}
          />
        );
      })}
    </div>
  );
}
