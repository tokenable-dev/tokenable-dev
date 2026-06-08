"use client";

import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
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
import { parseGradeScoreNumber, representativeGradeUsd } from "@/lib/market";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";

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
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  listingCount: number;
  marketChangeLoading?: boolean;
}) {
  const comp = collection.components;
  const jtSpot = representativeGradeUsd(
    snapshot?.gradePrices ?? null,
    parseGradeScoreNumber(comp.gradeScore),
    comp.gradeScore,
  );
  const marketPriceUsd =
    jtSpot != null && Number.isFinite(jtSpot) && jtSpot > 0 ? jtSpot : null;

  const changePctExternal =
    snapshot?.marketChangePct != null && Number.isFinite(snapshot.marketChangePct)
      ? snapshot.marketChangePct
      : null;
  const changePeriodMeta = referenceChangePeriodFromSnapshotMeta(snapshot);
  const changeWindowShort = formatReferenceChangePeriodFromSnapshotMeta(snapshot);
  const changeCoverageHint = formatReferenceChangeCoverageHint(changePeriodMeta);
  const pop = parsePsaPopulationFromComponents(comp);
  const marketsTitle = buildMarketsCollectionTitle({ collection, comp });

  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`}
      className={`group flex h-full flex-col overflow-hidden rounded-2xl outline-none ${GRID_CARD_SURFACE}`}
    >
      {/* 15% horizontal padding each side → image is 70% of card width (30% smaller).
          Top padding keeps the image away from the Link's overflow-hidden rounded corners.
          No local background — inherits Link surface so hover applies to the full card. */}
      <div className="shrink-0 px-[15%] pt-[8%] pb-[3%]">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-md">
          {(resolvedCoverUrl || collection.coverImageUrl) ? (
            <CollectionCoverFrame
              imageUrl={resolvedCoverUrl || collection.coverImageUrl!}
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

        <h3
          className="line-clamp-2 min-w-0 break-words text-[0.61rem] font-bold leading-snug text-zinc-400 max-[380px]:text-[9px] sm:text-[0.79rem]"
          title={marketsTitle}
        >
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
  );
}
