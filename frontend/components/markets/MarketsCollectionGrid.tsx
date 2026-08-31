"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { CollectibleCard } from "@/components/collectibles/CollectibleCard";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";
import { cn } from "@/lib/ds/cn";

export function MarketsCollectionGrid({
  collections,
  snapshotByKey,
  resolvedCoverMap,
  changeLoading = false,
  snapshotsFetching = false,
  onBeforeNavigate,
}: {
  collections: MarketplaceCollectionSummary[];
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
  resolvedCoverMap: Map<string, string>;
  changeLoading?: boolean;
  /** True while a later snapshot batch is in flight — only missing cards show “…”. */
  snapshotsFetching?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const seenKeysRef = useRef(new Set<string>());
  const enterKeys = useMemo(() => {
    const enter = new Set<string>();
    // Skip enter animation on the first paint so the initial grid doesn't cascade-fade.
    if (seenKeysRef.current.size === 0) return enter;
    for (const c of collections) {
      const key = c.collectionKey;
      if (key && !seenKeysRef.current.has(key)) enter.add(key);
    }
    return enter;
  }, [collections]);

  useEffect(() => {
    for (const c of collections) {
      if (c.collectionKey) seenKeysRef.current.add(c.collectionKey);
    }
  }, [collections]);

  return (
    <div className="markets-grid">
      {collections.map((collection, index) => {
        const key = collection.collectionKey;
        const keyLower = collectionKeyLower(collection);
        const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
        const snapshot = snapshotByKey.get(keyLower);

        return (
          <div
            key={key}
            className={cn(
              "markets-card-slot",
              enterKeys.has(key) && "markets-card-slot--enter",
            )}
          >
            <CollectibleCard
              collection={collection}
              snapshot={snapshot}
              resolvedCoverUrl={
                displayImageUrl ? resolvedCoverMap.get(displayImageUrl) : undefined
              }
              changeLoading={
                changeLoading || (snapshotsFetching && snapshot == null)
              }
              position={index}
              onBeforeNavigate={onBeforeNavigate}
            />
          </div>
        );
      })}
    </div>
  );
}
