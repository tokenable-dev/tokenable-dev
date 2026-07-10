"use client";

import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { CollectibleCard } from "@/components/collectibles/CollectibleCard";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";
import {
  isMarketsMockCollectionKey,
  marketsMockChangePeriodLabel,
} from "@/lib/markets/marketsMockData";

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
        const snapshot = snapshotByKey.get(collectionKeyLower(collection));
        const isMock = isMarketsMockCollectionKey(collection.collectionKey);
        return (
          <CollectibleCard
            key={collection.collectionKey}
            collection={collection}
            snapshot={snapshot}
            resolvedCoverUrl={
              displayImageUrl ? resolvedCoverMap.get(displayImageUrl) : undefined
            }
            changeLoading={changeLoading && !isMock}
            marketChangePctOverride={isMock ? (snapshot?.marketChangePct ?? null) : undefined}
            marketChangePeriodLabel={
              isMock ? marketsMockChangePeriodLabel(snapshot?.marketChangeWindow) : undefined
            }
            onBeforeNavigate={onBeforeNavigate}
          />
        );
      })}
    </div>
  );
}
