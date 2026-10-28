"use client";

import { memo } from "react";
import { useLocale } from "next-intl";
import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import Link from "next/link";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
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
  gradeLabelFromComp,
} from "@/lib/markets/marketsCollectionTitle";
import {
  resolveMarketsListingMarketChangePct,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { rememberCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

export const CollectibleCard = memo(function CollectibleCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  subMode: _subMode = "change",
  changeLoading = false,
  marketChangePctOverride,
  marketChangePeriodLabel,
  onBeforeNavigate,
  shell = "wrap",
  position,
  titleOverride,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  subMode?: "change" | "vaulted";
  changeLoading?: boolean;
  marketChangePctOverride?: number | null;
  marketChangePeriodLabel?: string;
  onBeforeNavigate?: () => void;
  shell?: "wrap" | "none";
  position?: number;
  /** List-level collision resolver can append the smallest differentiator. */
  titleOverride?: string;
}) {
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
  useLocale();
  useDisplayFx();
  const imageSrc = resolvedCoverUrl || displayImageUrl;
  const comp = parseCollectionComponents(collection.components);
  const grade = gradeLabelFromComp(comp);
  const line1Title =
    titleOverride?.trim() ||
    buildMarketsCollectionTitle({ collection, comp });
  const titleHover = buildMarketsCollectionHoverTitle({ collection, comp });
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct =
    marketChangePctOverride !== undefined
      ? marketChangePctOverride
      : resolveMarketsListingMarketChangePct(snapshot);
  const change = buildListingGradeCardChange({
    snapshot,
    changePct,
    changeLoading,
    periodLabel: marketChangePeriodLabel,
  });

  const href = `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`;

  const card = (
    <Link
      href={href}
      className="card"
      onClick={() => {
        rememberCollectionCoverImage(collection.collectionKey, imageSrc);
        trackEvent("card_clicked", {
          card_id: collection.collectionKey,
          card_name: line1Title,
          grade,
          price: priceUsd ?? undefined,
          position,
        });
        onBeforeNavigate?.();
      }}
    >
      <div className="card__img">
        {imageSrc ? (
          <CollectionPsaSlabFrame
            imageUrl={imageSrc}
            alt={line1Title}
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
        <WatchlistToggleButton
          collectionKey={collection.collectionKey}
          price={priceUsd ?? undefined}
        />
      </div>
      <div className="card__body">
        <ListingGradeCardLines
          title={line1Title}
          titleHover={titleHover}
          priceLabel={formatUsdCompact(priceUsd)}
          change={change}
        />
      </div>
    </Link>
  );

  if (shell === "none") {
    return card;
  }

  return <div className="card-wrap">{card}</div>;
});
