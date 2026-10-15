"use client";

import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { resolveMarketsListingMarketChangePct90d } from "@/lib/markets/marketsListingMarketPrice";
import { CollectibleCard } from "@/components/collectibles/CollectibleCard";

export function HomeCardGrid({
  collections,
  snapshotByKey,
  subMode = "change",
  changeLoading = false,
  use90dChange = false,
}: {
  collections: MarketplaceCollectionSummary[];
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
  subMode?: "change" | "vaulted";
  changeLoading?: boolean;
  /** Home Top movers — fixed 90-day reference % change. */
  use90dChange?: boolean;
}) {
  const coverSources = collections.map((c) => pickCollectionSummaryDisplayImageUrl(c));
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: collections.length > 0,
  });

  if (collections.length === 0) {
    return (
      <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">
        No collections to show yet.
      </p>
    );
  }

  return (
    <div className="home-listing-grid">
      <div
        className="markets-grid"
        id={subMode === "vaulted" ? "grid-vaulted" : "grid-movers"}
      >
        {collections.map((collection) => {
          const key = collection.collectionKey.toLowerCase();
          const snapshot = snapshotByKey.get(key);
          const changePctOverride = use90dChange
            ? resolveMarketsListingMarketChangePct90d(snapshot)
            : undefined;
          const periodLabel = use90dChange ? "90d" : undefined;
          return (
            <CollectibleCard
              key={collection.collectionKey}
              collection={collection}
              snapshot={snapshot}
              resolvedCoverUrl={(() => {
                const src = pickCollectionSummaryDisplayImageUrl(collection);
                return src ? coverUrlMap.get(src) : undefined;
              })()}
              subMode={subMode}
              changeLoading={changeLoading}
              marketChangePctOverride={changePctOverride}
              marketChangePeriodLabel={periodLabel}
              shell="none"
            />
          );
        })}
      </div>
    </div>
  );
}
