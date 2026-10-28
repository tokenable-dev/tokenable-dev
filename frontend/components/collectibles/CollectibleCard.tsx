"use client";

import { memo } from "react";
import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import Link from "next/link";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
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
  pctLabel: string;
  period: string;
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

function formatChangeSub(
  snapshot: CollectionListMarketSnapshot | undefined,
  changePct: number | null,
  changeLoading: boolean,
  periodLabel?: string,
): CardSub {
  if (changeLoading) {
    return { pctLabel: "…", period: "", tone: "muted" };
  }
  if (changePct == null || !Number.isFinite(changePct)) {
    return { pctLabel: "—", period: "", tone: "muted" };
  }
  const window = periodLabel?.trim() || formatCardChangePeriod(snapshot);
  const display = resolveReferencePercentChangeDisplay(changePct);
  return {
    glyph: listingCardChangeGlyph(display),
    pctLabel: display.pctLabel,
    period: display.showGlyph ? window : "",
    tone: display.tone,
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
  /** Search results — Line 2 `{Year} · {Set} {Language} · {Variant}` under Line 1. */
  showCatalogSubtitle?: boolean;
  /** List-level collision resolver can append the smallest differentiator. */
  titleOverride?: string;
}) {
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
  useDisplayFx();
  const imageSrc = resolvedCoverUrl || displayImageUrl;
  const comp = parseCollectionComponents(collection.components);
  const grade = gradeLabelFromComp(comp);
  const line1Title =
    titleOverride?.trim() ||
    buildMarketsCollectionTitle(
      { collection, comp },
      { splitGradeToSecondLine: true },
    );
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
        <div className="card__title" title={titleHover || line1Title}>
          {line1Title}
        </div>
        <div className="card__grade-line">{grade}</div>
        {catalogSubtitle ? <div className="card__set">{catalogSubtitle}</div> : null}
        <div className="card__price-row">
          <span className="card__price">{formatUsdCompact(priceUsd)}</span>
          <ListingCardChange
            pctLabel={sub.pctLabel}
            tone={sub.tone}
            glyph={sub.glyph}
            period={sub.period}
          />
        </div>
      </div>
    </Link>
  );

  if (shell === "none") {
    return card;
  }

  return <div className="card-wrap">{card}</div>;
});
