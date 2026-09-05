"use client";

import { memo } from "react";
import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  isFlatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import {
  buildMarketsCollectionHoverTitle,
  buildMarketsCollectionMeta,
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

type CardSub = {
  glyph?: string;
  label: string;
  tone: "up" | "down" | "muted" | "accent";
};

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

function formatChangeSub(
  snapshot: CollectionListMarketSnapshot | undefined,
  changePct: number | null,
  changeLoading: boolean,
  periodLabel?: string,
): CardSub {
  if (changeLoading) {
    return { label: "…", tone: "muted" };
  }
  if (changePct == null || !Number.isFinite(changePct)) {
    return { label: "—", tone: "muted" };
  }
  const tone = referenceChangeTone(changePct);
  const window = periodLabel?.trim() || formatCardChangePeriod(snapshot);
  const pct = formatCardChangePercent(changePct);
  const glyph = tone === "down" ? "\u25BC" : "\u25B2";
  return {
    glyph,
    label: `${pct} \u00b7 ${window}`,
    tone: tone === "down" ? "down" : "up",
  };
}

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
  showCatalogSubtitle = false,
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
  /** Search results — Line 2 `{Year} · {Set} {Language} · {Variant}` under Line 1. */
  showCatalogSubtitle?: boolean;
}) {
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
  const imageSrc = resolvedCoverUrl || displayImageUrl;
  const comp = parseCollectionComponents(collection.components);
  const grade = gradeLabelFromComp(comp);
  const title = buildMarketsCollectionTitle({ collection, comp });
  const titleHover = buildMarketsCollectionHoverTitle({ collection, comp });
  const catalogSubtitle = showCatalogSubtitle
    ? buildMarketsCollectionMeta({ collection, comp })
    : "";
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct =
    marketChangePctOverride !== undefined
      ? marketChangePctOverride
      : resolveMarketsListingMarketChangePct(snapshot);
  const changePeriod =
    marketChangePeriodLabel?.trim() || formatCardChangePeriod(snapshot);

  const sub = formatChangeSub(snapshot, changePct, changeLoading, changePeriod);

  const href = `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`;

  const card = (
    <Link
      href={href}
      className="card"
      onClick={() => {
        rememberCollectionCoverImage(collection.collectionKey, imageSrc);
        trackEvent("card_clicked", {
          card_id: collection.collectionKey,
          card_name: title,
          grade,
          price: priceUsd ?? undefined,
          position,
        });
        onBeforeNavigate?.();
      }}
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
          <WatchlistToggleButton
            collectionKey={collection.collectionKey}
            price={priceUsd ?? undefined}
          />
        </div>
      </div>
      <div className="card__body">
        <div className="card__title" title={titleHover || title}>
          {title}
        </div>
        {catalogSubtitle ? <div className="card__set">{catalogSubtitle}</div> : null}
        <div className="card__price-row">
          <span className="card__price">{formatUsdCompact(priceUsd)}</span>
          <span className={`card__sub card__sub--${sub.tone}`}>
            {sub.glyph ? (
              <span className="card__sub-glyph" aria-hidden>
                {sub.glyph}
              </span>
            ) : null}
            {sub.label}
          </span>
        </div>
      </div>
    </Link>
  );

  if (shell === "none") {
    return card;
  }

  return <div className="card-wrap">{card}</div>;
});
