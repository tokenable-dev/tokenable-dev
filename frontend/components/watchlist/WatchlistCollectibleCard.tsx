"use client";

import { memo } from "react";
import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import { TkButton } from "@/components/ds";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  isFlatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import {
  buildMarketsCollectionHeadlineParts,
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

function formatCardChangePercent(pct: number): string {
  if (isFlatReferencePercentChange(pct)) return "0.0%";
  const sign = pct > 0 ? "+" : "";
  const rounded = Math.round(pct * 10) / 10;
  const nearInt = Math.abs(rounded - Math.round(rounded)) < 0.05;
  if (nearInt && Math.abs(rounded) >= 100) {
    return `${sign}${Math.round(rounded)}%`;
  }
  return `${sign}${rounded.toFixed(1)}%`;
}

function resolveChangeDisplay(
  snapshot: CollectionListMarketSnapshot | undefined,
  changePct: number | null,
  changeLoading: boolean,
): { pctLabel: string; period: string; tone: "up" | "down" | "muted" } {
  if (changeLoading) {
    return { pctLabel: "…", period: "", tone: "muted" };
  }
  if (changePct == null || !Number.isFinite(changePct)) {
    return { pctLabel: "—", period: "", tone: "muted" };
  }
  const tone = referenceChangeTone(changePct);
  const period = formatCardChangePeriod(snapshot);
  const pct = formatCardChangePercent(changePct);
  const arrow = tone === "down" ? "▼ " : "▲ ";
  return {
    pctLabel: `${arrow}${pct}`,
    period,
    tone: tone === "down" ? "down" : "up",
  };
}

export type WatchlistRowModel = {
  href: string;
  title: string;
  titleHover: string;
  headlineParts: ReturnType<typeof buildMarketsCollectionHeadlineParts>;
  grade: string;
  priceLabel: string;
  change: { pctLabel: string; period: string; tone: "up" | "down" | "muted" };
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
  const headlineParts = buildMarketsCollectionHeadlineParts({ collection, comp });
  const grade = gradeLabelFromComp(comp);
  const title = buildMarketsCollectionTitle({ collection, comp });
  const titleHover = buildMarketsCollectionHoverTitle({ collection, comp });
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct = resolveMarketsListingMarketChangePct(snapshot);
  return {
    href: `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`,
    title,
    titleHover,
    headlineParts,
    grade,
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
  const { href, title, titleHover, headlineParts, grade, priceLabel, change, imageSrc } = row;

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
          <CollectionCoverFrame
            imageUrl={imageSrc}
            variant="flat"
            className="h-full w-full"
            quietLoading
          />
        ) : (
          <div className="h-full w-full bg-[#111113]" aria-hidden />
        )}
        <div className="card__fade" aria-hidden />
        <div className="fav">
          <WatchlistToggleButton collectionKey={collection.collectionKey} />
        </div>
      </div>
      <div className="card__body">
        <div className="card__title" title={titleHover || title}>
          <AssetDetailHeadlineTitle
            as="span"
            parts={headlineParts}
            grade={grade}
            className="block min-w-0 text-[inherit] font-[inherit] leading-[inherit] text-inherit [--cd-line1-lh:1.2]"
          />
        </div>
        <div className="card__price-row">
          <span className="card__price">{priceLabel}</span>
          <span className={`card__sub card__sub--${change.tone}`}>
            {change.pctLabel}
            {change.period ? <span className="card__per"> {change.period}</span> : null}
          </span>
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
