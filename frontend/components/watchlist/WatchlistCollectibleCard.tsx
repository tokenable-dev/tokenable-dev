"use client";

import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { TkButton } from "@/components/ds";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  isFlatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import {
  resolveMarketsListingMarketChangePct,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { rememberCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

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

function formatGradeLabel(collection: MarketplaceCollectionSummary): string | null {
  const comp = parseCollectionComponents(collection.components);
  const company = (comp.gradingCompanyDisplay ?? comp.gradingCompany)?.trim();
  const score = comp.gradeScore?.trim();
  if (company && score) return `${company} ${score}`;
  const label = comp.psaGradeLabel?.trim();
  if (label) return label;
  if (score) {
    const fallbackCompany = comp.gradingCompany?.trim() || "PSA";
    return `${fallbackCompany} ${score}`;
  }
  return null;
}

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
  grade: string | null;
  popLabel: string | null;
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
  const title = buildMarketsCollectionTitle({ collection, comp, omitGrade: true });
  const grade = formatGradeLabel(collection);
  const pop =
    typeof comp.psaTotalPopulation === "number" && comp.psaTotalPopulation >= 0
      ? Math.floor(comp.psaTotalPopulation)
      : null;
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct = resolveMarketsListingMarketChangePct(snapshot);
  return {
    href: `/marketplace/collections/${encodeURIComponent(collection.collectionKey)}`,
    title,
    grade,
    popLabel: pop != null ? formatBadgeCount(pop) : null,
    priceLabel: formatUsdCompact(priceUsd),
    change: resolveChangeDisplay(snapshot, changePct, changeLoading),
    imageSrc,
  };
}

export function WatchlistCollectibleCard({
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
  const { href, title, grade, popLabel, priceLabel, change, imageSrc } = row;

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
        <div className="card__title">{title}</div>
        <div className="card__meta watchlist-card__meta">
          {grade ? <span className="watchlist-card__grade">{grade}</span> : null}
          {popLabel != null ? (
            <span className="card__stat">
              POP<span className="card__stat-val">{popLabel}</span>
            </span>
          ) : null}
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
}
