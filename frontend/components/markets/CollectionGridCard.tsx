"use client";

import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import { MarketsListingPriceWithChange } from "@/components/marketplace/marketplace-shared";
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import {
  formatReferenceChangeCoverageHint,
  formatReferenceChangePeriodFromSnapshotMeta,
  referenceChangePeriodFromSnapshotMeta,
} from "@/lib/market";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { resolveMarketsListingMarketUsd, resolveMarketsListingMarketChangePct } from "@/lib/markets/marketsListingMarketPrice";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";

const CARD_BADGE_BASE =
  "box-border inline-flex min-h-[20px] shrink-0 items-center justify-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-tight sm:min-h-[22px] sm:rounded-[3px] sm:px-[5px] sm:py-0 sm:text-[10px] md:text-[11px]";

const CARD_BADGE_NEUTRAL = `${CARD_BADGE_BASE} gap-0.5 whitespace-nowrap border-[rgba(255,255,255,0.22)] bg-black/50 text-zinc-400`;

const CARD_BADGE_KV_LABEL = "text-zinc-400";
const CARD_BADGE_KV_VALUE = "tabular-nums text-white";

const GRID_CARD_BADGE_ROW =
  "mobile-scroll-x-contain flex min-w-0 max-w-full flex-nowrap items-center gap-1 scroll-smooth touch-pan-x [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[380px]:gap-0.5 sm:gap-1.5";

/** Slightly lifted from page `bg-black` — single surface on the Link so hover covers image + text. */
const GRID_CARD_SURFACE =
  "bg-[#0d0d0d] transition-[background-color,box-shadow] duration-200 ease-out hover:bg-[#141414] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.75)]";

/** Markets grid + landing carousel — Arial, smaller card name (design spec). */
export const MARKETS_GRID_CARD_TITLE_CLASS =
  "line-clamp-2 min-w-0 break-words font-[Arial,Helvetica,sans-serif] text-[0.61rem] font-bold leading-snug text-zinc-400 max-[380px]:text-[9px] sm:text-[0.79rem]";

function formatBadgeCount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    const k = n / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString("en-US");
}

function KvBadge({
  label,
  value,
  title,
  valueClassName,
}: {
  label: string;
  value: string;
  title?: string;
  valueClassName?: string;
}) {
  return (
    <span className={CARD_BADGE_NEUTRAL} title={title ?? `${label} ${value}`}>
      <span className={CARD_BADGE_KV_LABEL}>{label}</span>
      <span className={valueClassName ?? CARD_BADGE_KV_VALUE}>{value}</span>
    </span>
  );
}

function parsePsaPopulationFromComponents(components: import("@/lib/marketplace/collectionDetailComponents").CollectionComponents): number | null {
  const raw = components.psaTotalPopulation;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return null;
}

export function CollectionGridCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  listingCount,
  marketChangeLoading = false,
  onBeforeNavigate,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  listingCount: number;
  marketChangeLoading?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const comp = collection.components;
  const marketPriceUsd = resolveMarketsListingMarketUsd(collection, snapshot);

  const changePctExternal = resolveMarketsListingMarketChangePct(snapshot);
  const changePeriodMeta = referenceChangePeriodFromSnapshotMeta(snapshot);
  const changeWindowShort = formatReferenceChangePeriodFromSnapshotMeta(snapshot);
  const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriodMeta);
  const pop = parsePsaPopulationFromComponents(comp);
  const marketsTitle = buildMarketsCollectionTitle({ collection, comp });
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);

  return (
    <div className="relative h-full">
      <div className="pointer-events-none absolute right-1 top-1 z-10 sm:right-1.5 sm:top-1.5">
        <div className="pointer-events-auto">
          <WatchlistToggleButton collectionKey={collection.collectionKey} size="sm" />
        </div>
      </div>
      <Link
        href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl outline-none ${GRID_CARD_SURFACE}`}
        onClick={() => onBeforeNavigate?.()}
      >
      {/* 15% horizontal padding each side → image is 70% of card width (30% smaller).
          Top padding keeps the image away from the Link's overflow-hidden rounded corners.
          No local background — inherits Link surface so hover applies to the full card. */}
      <div className="shrink-0 px-[15%] pt-[8%] pb-[3%]">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-md">
          {displayImageUrl ? (
            <CollectionCoverFrame
              imageUrl={resolvedCoverUrl || displayImageUrl}
              variant="flat"
              className="h-full w-full"
            />
          ) : (
            <div className="h-full w-full bg-zinc-900" />
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 max-[380px]:p-1.5 sm:gap-2 sm:p-3">
        <div className={GRID_CARD_BADGE_ROW}>
          {pop != null ? (
            <KvBadge
              label="Pop"
              value={formatBadgeCount(pop)}
              title={`PSA population: ${pop.toLocaleString()}`}
            />
          ) : null}
          <KvBadge
            label="Listed"
            value={formatBadgeCount(listingCount)}
            title={`${listingCount} listing${listingCount !== 1 ? "s" : ""} on Tokenable`}
          />
        </div>

        <h3 className={MARKETS_GRID_CARD_TITLE_CLASS} title={marketsTitle}>
          {marketsTitle}
        </h3>

        <div className="mt-auto w-full min-w-0 pt-0.5">
          <MarketsListingPriceWithChange
            priceUsd={marketPriceUsd}
            changePct={changePctExternal}
            loading={marketChangeLoading}
            windowShort={changeWindowShort}
            titleDetail={changeCoverageHint}
            priceTitle="External eBay reference price."
            align="start"
          />
        </div>
      </div>
    </Link>
    </div>
  );
}
