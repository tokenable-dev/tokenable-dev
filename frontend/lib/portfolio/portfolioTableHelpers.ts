import type {
  CollectionMarketSeries,
  CollectionPlatformTapeFill,
  CollectionUsdPoint,
  RwaMetadata,
} from "@/lib/core";
import { filterMergedChartPointsForWindow } from "@/lib/market/collectionChartHistory";
import { countableTapeFills } from "@/lib/market/tradesVolume";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  buildRwaAssetDetailHeadlineParts,
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayHoverTitle,
  formatCardDisplayLine1,
  resolveRwaHeadlineGrade,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";

export { formatPortfolioGradeLabel, formatPortfolioGradeSubtitle } from "@/lib/portfolio/portfolioAssetMeta";

export type PortfolioHoldingsHeadline = {
  parts: AssetDetailHeadlineParts;
  grade: string;
  line1: string;
  hover: string;
};

/** Portfolio holdings — SSOT Line 1 parts + formatted strings. */
export function resolvePortfolioHoldingsHeadlines(
  rows: AssetRow[],
  metadataByTokenId: Map<number, RwaMetadata | null>,
): Map<number, PortfolioHoldingsHeadline> {
  const out = new Map<number, PortfolioHoldingsHeadline>();
  for (const row of rows) {
    const meta = metadataByTokenId.get(row.tokenId) ?? null;
    const fallback = `RWA #${row.tokenId}`;
    const parts = buildRwaAssetDetailHeadlineParts(meta, fallback);
    const grade = resolveRwaHeadlineGrade(meta);
    const line1 = formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts, grade));
    const hover = formatCardDisplayHoverTitle(parts, { grade });
    out.set(row.tokenId, {
      parts,
      grade,
      line1: line1 || row.name,
      hover: hover || line1 || row.name,
    });
  }
  return out;
}

/** Portfolio holdings — Line 1 titles (`{Name} · {Number} · {Grade}`). */
export function resolvePortfolioHoldingsDisplayNames(
  rows: AssetRow[],
  metadataByTokenId: Map<number, RwaMetadata | null>,
): Map<number, string> {
  const headlines = resolvePortfolioHoldingsHeadlines(rows, metadataByTokenId);
  const out = new Map<number, string>();
  for (const row of rows) {
    out.set(row.tokenId, headlines.get(row.tokenId)?.line1 ?? row.name);
  }
  return out;
}

export function formatPortfolioUsd(
  value: number | null | undefined,
  opts?: { compact?: boolean },
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (opts?.compact && value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (opts?.compact && value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPortfolioProfitReturn(
  costBasis: number | null | undefined,
  currentValue: number | null | undefined,
): { profit: string; returnPct: string; positive: boolean } | null {
  if (
    costBasis == null ||
    currentValue == null ||
    !Number.isFinite(costBasis) ||
    !Number.isFinite(currentValue) ||
    costBasis <= 0
  ) {
    return null;
  }
  const delta = currentValue - costBasis;
  const pct = (delta / costBasis) * 100;
  const sign = delta >= 0 ? "+" : "-";
  const absUsd = Math.abs(delta);
  const usd =
    absUsd >= 1000
      ? absUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : absUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    profit: `${sign}$${usd}`,
    returnPct: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`,
    positive: delta >= 0,
  };
}

function downsampleSparklineValues(values: number[], maxPoints: number): number[] {
  if (values.length < 2) return [];
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(values[Math.round(i * step)]!);
  }
  return out;
}

export function extractSparklineValues(
  series: CollectionMarketSeries | null | undefined,
  maxPoints = 14,
): number[] {
  const values = (series?.externalUsd ?? [])
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return downsampleSparklineValues(values, maxPoints);
}

/** Portfolio gallery spark — last ~365d of comps-merged external USD. */
export function extractSparklineValues1y(
  series: CollectionMarketSeries | null | undefined,
  maxPoints = 14,
): number[] {
  const windowed: CollectionUsdPoint[] = filterMergedChartPointsForWindow(
    series?.externalUsd,
    "365d",
  );
  const values = windowed
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  return downsampleSparklineValues(values, maxPoints);
}

/** Sparkline from token tape (platform fills + Cardhedger comps) when no collection snapshot exists. */
export function extractSparklineFromTapeFills(
  trades: CollectionPlatformTapeFill[] | null | undefined,
  maxPoints = 14,
): number[] {
  const points: CollectionUsdPoint[] = countableTapeFills(trades ?? [])
    .map((row) => ({ t: row.t, v: row.priceUsdc }))
    .sort((a, b) => a.t - b.t);
  const windowed = filterMergedChartPointsForWindow(points, "365d");
  const values = windowed
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  return downsampleSparklineValues(values, maxPoints);
}

export function compareSortText(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function compareSortNum(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: "asc" | "desc",
): number {
  const na = a != null && Number.isFinite(a) ? a : Number.NEGATIVE_INFINITY;
  const nb = b != null && Number.isFinite(b) ? b : Number.NEGATIVE_INFINITY;
  if (na !== nb) return dir === "asc" ? na - nb : nb - na;
  return 0;
}
