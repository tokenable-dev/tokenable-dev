"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioDailySnapshots } from "@/lib/core";
import { formatSnapshotAxisLabel } from "@/lib/portfolio/portfolioAssetMeta";

export function usePortfolioDailyChart(
  address: string | undefined,
  isConnected: boolean,
) {
  const { data: dailySnapshotsData, isLoading: dailySnapshotsLoading } = useQuery({
    queryKey: ["portfolio-daily-snapshots", address ?? ""] as const,
    queryFn: () => getPortfolioDailySnapshots(address!, 32),
    enabled: Boolean(address && isConnected),
    staleTime: 120_000,
  });

  const dailyPnlUsd = dailySnapshotsData?.latest24h?.pnlUsd ?? null;
  const dailyPnlPct = dailySnapshotsData?.latest24h?.pnlPct ?? null;
  const hasDailyPnl = dailyPnlUsd != null;

  const dailyChartSeries = useMemo(() => {
    const rows = dailySnapshotsData?.items ?? [];
    const sorted = [...rows].sort(
      (a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime(),
    );
    const series: { value: number; label: string }[] = [];
    for (const r of sorted) {
      const v = r.totalValueUsd;
      if (!Number.isFinite(v) || v < 0) continue;
      series.push({
        value: v,
        label: formatSnapshotAxisLabel(r.snapshotDateKst),
      });
    }
    return series;
  }, [dailySnapshotsData?.items]);

  const dailyChartPoints = useMemo(
    () => dailyChartSeries.map((s) => s.value),
    [dailyChartSeries],
  );
  const dailyChartLabels = useMemo(
    () => dailyChartSeries.map((s) => s.label),
    [dailyChartSeries],
  );

  return {
    dailySnapshotsLoading,
    dailyPnlUsd,
    dailyPnlPct,
    hasDailyPnl,
    dailyChartPoints,
    dailyChartLabels,
  };
}
