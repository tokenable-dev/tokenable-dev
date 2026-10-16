"use client";

import { memo } from "react";
import Link from "next/link";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
import { TkButton } from "@/components/ds";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { resolveReferencePercentChangeDisplay } from "@/lib/market/priceChangePeriod";
import {
  ListingCardChange,
  listingCardChangeGlyph,
} from "@/components/collectibles/ListingCardChange";
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

function formatCardChangePeriod(snapshot: CollectionListMarketSnapshot | undefined): string {
  if (!snapshot) return "1Y";
  const w = snapshot.marketChangeWindow;
  if (snapshot.marketChangeIsFullYear || w === "365d") return "1Y";
  if (w === "180d") return "180d";
  if (w === "90d") return "90d";
  if (w === "30d") return "30d";
  if (w === "7d") return "7d";
  return "1Y";
}

function resolveChangeDisplay(
  snapshot: CollectionListMarketSnapshot | undefined,
  changePct: number | null,
  changeLoading: boolean,
): {
  pctLabel: string;
  period: string;
  tone: "up" | "down" | "muted";
  glyph?: string;
} {
  if (changeLoading) {
    return { pctLabel: "…", period: "", tone: "muted" };
  }
  if (changePct == null || !Number.isFinite(changePct)) {
    return { pctLabel: "—", period: "", tone: "muted" };
  }
  const period = formatCardChangePeriod(snapshot);
  const display = resolveReferencePercentChangeDisplay(changePct);
  return {
    pctLabel: display.pctLabel,
    glyph: listingCardChangeGlyph(display),
    period: display.showGlyph ? period : "",
    tone: display.tone,
  };
}

export type WatchlistRowModel = {
  href: string;
  title: string;
  gradeLabel: string;
  titleHover: string;
  priceLabel: string;
  change: {
    pctLabel: string;
    period: string;
    tone: "up" | "down" | "muted";
    glyph?: string;
  };
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
  const title = buildMarketsCollectionTitle(
    { collection, comp },
    { splitGradeToSecondLine: true },
  );
  const gradeLabel = gradeLabelFromComp(comp);
  const titleHover = buildMarketsCollectionHoverTitle({ collection, comp });
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct = resolveMarketsListingMarketChangePct(snapshot);
  return {
    href: `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`,
    title,
    gradeLabel,
    titleHover,
    priceLabel: formatUsdCompact(priceUsd),
    change: resolveChangeDisplay(snapshot, changePct, changeLoading),
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
  const row = buildWatchlistRowModel(
    collection,
    snapshot,
    resolvedCoverUrl,
    changeLoading,
  );
  const { href, title, gradeLabel, titleHover, priceLabel, change, imageSrc } =
    row;
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
        <div className="card__title" title={titleHover || title}>
          {title}
        </div>
        <div className="card__grade-line">{gradeLabel}</div>
        <div className="card__price-row">
          <span className="card__price">{priceLabel}</span>
          <ListingCardChange
            pctLabel={change.pctLabel}
            tone={change.tone}
            glyph={change.glyph}
            period={change.period}
          />
        </div>
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
