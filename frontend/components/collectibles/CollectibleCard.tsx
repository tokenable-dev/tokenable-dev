"use client";

import Link from "next/link";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  isFlatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import { buildMarketsCollectionMeta, buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import {
  resolveMarketsListingMarketChangePct,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { rememberCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

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

type CardSub = {
  label: string;
  period?: string;
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

/** index.html / Markets.html — e.g. `▲ +793.8%` with `180d` in `.card__per` */
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
  const arrow = tone === "down" ? "▼ " : "▲ ";
  return {
    label: `${arrow}${pct}`,
    period: window,
    tone: tone === "down" ? "down" : "up",
  };
}

export function CollectibleCard({
  collection,
  snapshot,
  resolvedCoverUrl,
  subMode = "change",
  changeLoading = false,
  marketChangePctOverride,
  marketChangePeriodLabel,
  onBeforeNavigate,
  shell = "wrap",
  position,
  /** Markets grid: hide Year · Set · Variant under the title. */
  showSetLine = true,
  /** Markets grid: grade lives in the badge row — omit from title. */
  omitGradeInTitle = false,
}: {
  collection: MarketplaceCollectionSummary;
  snapshot: CollectionListMarketSnapshot | undefined;
  resolvedCoverUrl?: string;
  /** Home "just vaulted" uses muted copy when change is unavailable. */
  subMode?: "change" | "vaulted";
  changeLoading?: boolean;
  /** When set (e.g. home Top movers 90d), overrides snapshot bundle % change. */
  marketChangePctOverride?: number | null;
  marketChangePeriodLabel?: string;
  onBeforeNavigate?: () => void;
  /** index.html grid4 uses `<a class="card">` directly; markets/watchlist keep `.card-wrap`. */
  shell?: "wrap" | "none";
  /** Zero-based position in the grid — forwarded to `card_clicked` analytics. */
  position?: number;
  showSetLine?: boolean;
  omitGradeInTitle?: boolean;
}) {
  const displayImageUrl = pickCollectionSummaryDisplayImageUrl(collection);
  const imageSrc = resolvedCoverUrl || displayImageUrl;
  const title = buildMarketsCollectionTitle({
    collection,
    comp: collection.components,
    omitGrade: omitGradeInTitle,
  });
  const setLine = showSetLine
    ? buildMarketsCollectionMeta({
        collection,
        comp: collection.components,
      })
    : "";
  const grade = formatGradeLabel(collection);
  const titleHover = [title, setLine].filter(Boolean).join(" · ");
  const priceUsd = resolveMarketsListingMarketUsd(collection, snapshot);
  const changePct =
    marketChangePctOverride !== undefined
      ? marketChangePctOverride
      : resolveMarketsListingMarketChangePct(snapshot);
  const changePeriod =
    marketChangePeriodLabel?.trim() || formatCardChangePeriod(snapshot);
  const comp = parseCollectionComponents(collection.components);
  const pop =
    typeof comp.psaTotalPopulation === "number" && comp.psaTotalPopulation >= 0
      ? Math.floor(comp.psaTotalPopulation)
      : null;
  const listed = collection.activeListingCount;

  let sub = formatChangeSub(snapshot, changePct, changeLoading, changePeriod);
  if (
    subMode === "vaulted" &&
    !changeLoading &&
    (changePct == null || !Number.isFinite(changePct))
  ) {
    sub = { label: "Just listed", tone: "muted" };
  }

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
          grade: grade ?? undefined,
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
            size="sm"
            price={priceUsd ?? undefined}
          />
        </div>
      </div>
      <div className="card__body">
        <div className="card__title" title={titleHover || title}>
          {title}
        </div>
        {setLine ? <div className="card__set">{setLine}</div> : null}
        <div className="card__meta">
          {grade ? <span className="card__grade">{grade}</span> : null}
          {pop != null ? (
            <span className="card__stat">
              POP<span className="card__stat-val">{formatBadgeCount(pop)}</span>
            </span>
          ) : null}
          <span className="card__stat">
            LISTED<span className="card__stat-val">{formatBadgeCount(listed)}</span>
          </span>
        </div>
        <div className="card__price-row">
          <span className="card__price">{formatUsdCompact(priceUsd)}</span>
          <span className={`card__sub card__sub--${sub.tone}`}>
            {sub.label}
            {sub.period ? <span className="card__per">{sub.period}</span> : null}
          </span>
        </div>
      </div>
    </Link>
  );

  if (shell === "none") {
    return card;
  }

  return <div className="card-wrap">{card}</div>;
}
