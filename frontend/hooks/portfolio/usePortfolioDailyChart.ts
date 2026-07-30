"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioDailySnapshots, rq, marketplaceRqPolicy } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  buildPortfolioChartSeriesFromSnapshots,
  latestSnapshotValueUsd,
  portfolioPnlFromChartSeries,
} from "@/lib/portfolio/portfolioChartSeries";

export function usePortfolioDailyChart(
  address: string | undefined,
  isConnected: boolean,
) {
  const chainId = activeRqChainId();
  const { data: dailySnapshotsData, isLoading: dailySnapshotsLoading } = useQuery({
    queryKey: rq.portfolioDailySnapshots(address ?? "", chainId),
    queryFn: () => getPortfolioDailySnapshots(address!, 32),
    enabled: Boolean(address && isConnected),
    staleTime: marketplaceRqPolicy.portfolioDailyStaleMs,
  });

  const dailyPnlUsd = dailySnapshotsData?.latest24h?.pnlUsd ?? null;
  const dailyPnlPct = dailySnapshotsData?.latest24h?.pnlPct ?? null;

  const dailyChartSeries = useMemo(
    () => buildPortfolioChartSeriesFromSnapshots(dailySnapshotsData?.items ?? []),
    [dailySnapshotsData?.items],
  );

  const portfolioValue = useMemo(
    () => latestSnapshotValueUsd(dailySnapshotsData?.items ?? []),
    [dailySnapshotsData?.items],
  );

  const snapshotPnl = useMemo(
    () => portfolioPnlFromChartSeries(dailyChartSeries),
    [dailyChartSeries],
  );

  const resolvedDailyPnlUsd = dailyPnlUsd ?? snapshotPnl.pnlUsd;
  const resolvedDailyPnlPct = dailyPnlPct ?? snapshotPnl.pnlPct;
  const hasDailyPnl = resolvedDailyPnlUsd != null;

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
    portfolioValue,
    dailyPnlUsd: resolvedDailyPnlUsd,
    dailyPnlPct: resolvedDailyPnlPct,
    hasDailyPnl,
    dailyChartPoints,
    dailyChartLabels,
  };
}
