"use client";

import { memo } from "react";
import { useLocale } from "next-intl";
import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import Link from "next/link";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
import { TkButton } from "@/components/ds";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  ListingGradeCardLines,
  buildListingGradeCardChange,
} from "@/components/collectibles/ListingGradeCardLines";
import {
  buildMarketsCollectionHoverTitle,
  buildMarketsCollectionTitle,
} from "@/lib/markets/marketsCollectionTitle";
import {
  resolveMarketsListingMarketChangePct,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { rememberCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export type WatchlistRowModel = {
  href: string;
  title: string;
  titleHover: string;
  priceLabel: string;
  change: ReturnType<typeof buildListingGradeCardChange>;
  imageSrc: string | null;
};

export function buildWatchlistRowModel(
  collection: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  resolvedCoverUrl: string | undefined,
  changeLoading: boolean,
): WatchlistRowModel {
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
  const imageSrc = resolvedCoverUrl || displayImageUrl;
  const comp = parseCollectionComponents(collection.components);
  const title = buildMarketsCollectionTitle({ collection, comp });
  const titleHover = buildMarketsCollectionHoverTitle({ collection, comp });
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct = resolveMarketsListingMarketChangePct(snapshot);
  return {
    href: `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`,
    title,
    titleHover,
    priceLabel: formatUsdCompact(priceUsd),
    change: buildListingGradeCardChange({
      snapshot,
      changePct,
      changeLoading,
    }),
    imageSrc,
  };
}

export const WatchlistCollectibleCard = memo(function WatchlistCollectibleCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  changeLoading = false,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  changeLoading?: boolean;
}) {
  useDisplayFx();
  useLocale();
  const row = buildWatchlistRowModel(
    collection,
    snapshot,
    resolvedCoverUrl,
    changeLoading,
  );
  const { href, title, titleHover, priceLabel, change, imageSrc } = row;
  const comp = parseCollectionComponents(collection.components);

  return (
    <Link
      href={href}
      className="card watchlist-card"
      onClick={() =>
        rememberCollectionCoverImage(collection.collectionKey, imageSrc)
      }
    >
      <div className="card__img">
        {imageSrc ? (
          <CollectionPsaSlabFrame
            imageUrl={imageSrc}
            alt={title}
            comp={comp}
            displayLabel={collection.displayLabel}
            collectionKey={collection.collectionKey}
            chamberFit="contain"
          />
        ) : (
          <div className="h-full w-full bg-[#111113]" aria-hidden />
        )}
        <div className="card__fade" aria-hidden />
      </div>
      <div className="fav">
        <WatchlistToggleButton collectionKey={collection.collectionKey} />
      </div>
      <div className="card__body">
        <ListingGradeCardLines
          title={title}
          titleHover={titleHover}
          priceLabel={priceLabel}
          change={change}
        />
        <div className="watchlist-card-actions" aria-hidden>
          <TkButton variant="primary" size="sm" decorative className="watchlist-card-actions__btn">
            Buy
          </TkButton>
          <TkButton variant="ghost" size="sm" decorative className="watchlist-card-actions__btn">
            Bid
          </TkButton>
        </div>
      </div>
    </Link>
  );
});
