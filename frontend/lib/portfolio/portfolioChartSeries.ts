import type { PortfolioDailySnapshotItem } from "@/lib/core/api/portfolio";
import { formatSnapshotAxisLabel } from "@/lib/portfolio/portfolioAssetMeta";

export type PortfolioChartPoint = { value: number; label: string };

/** Daily 09:00 KST snapshot series — authoritative source for portfolio value + 24h P/L. */
export function buildPortfolioChartSeriesFromSnapshots(
  snapshots: PortfolioDailySnapshotItem[],
): PortfolioChartPoint[] {
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
  );

  const series: PortfolioChartPoint[] = [];
  for (const row of sorted) {
    const v = row.totalValueUsd;
    if (!Number.isFinite(v) || v < 0) continue;
    series.push({
      value: v,
      label: formatSnapshotAxisLabel(row.snapshotDateKst),
    });
  }
  return series;
}

export function latestSnapshotValueUsd(
  snapshots: PortfolioDailySnapshotItem[],
): number | null {
  if (snapshots.length === 0) return null;
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.snapshotAt).getTime() - new Date(a.snapshotAt).getTime(),
  );
  const v = sorted[0]?.totalValueUsd;
  return v != null && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Compare last two snapshot buckets (same logic as API latest24h fallback). */
export function portfolioPnlFromChartSeries(series: PortfolioChartPoint[]): {
  pnlUsd: number | null;
  pnlPct: number | null;
} {
  if (series.length < 2) return { pnlUsd: null, pnlPct: null };
  const prev = series[series.length - 2]!.value;
  const latest = series[series.length - 1]!.value;
  if (!Number.isFinite(prev) || !Number.isFinite(latest) || prev <= 0) {
    return { pnlUsd: null, pnlPct: null };
  }
  const pnlUsd = latest - prev;
  const pnlPct = (pnlUsd / prev) * 100;
  return { pnlUsd, pnlPct };
}
