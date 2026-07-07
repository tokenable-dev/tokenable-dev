import type { CollectionMarketSeries } from "@/lib/core";

export { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioAssetMeta";

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

export function formatPortfolioPnl(
  costBasis: number | null | undefined,
  currentValue: number | null | undefined,
): { label: string; positive: boolean } | null {
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
  const pctLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
  return {
    label: `${sign}$${usd} (${pctLabel})`,
    positive: delta >= 0,
  };
}

export function extractSparklineValues(
  series: CollectionMarketSeries | null | undefined,
  maxPoints = 14,
): number[] {
  const raw = series?.externalUsd ?? [];
  const values = raw
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return [];
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(values[Math.round(i * step)]);
  }
  return out;
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
