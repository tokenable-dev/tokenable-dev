"use client";

import { useMemo, useState } from "react";
import { formatUsdCompact } from "@/lib/market";
import { PortfolioValueChart } from "./PortfolioValueChart";

export type PortfolioChartPeriod = "1d" | "1w" | "1m";

const PERIOD_LABELS: { id: PortfolioChartPeriod; label: string; slice: number }[] = [
  { id: "1d", label: "1D", slice: 7 },
  { id: "1w", label: "1W", slice: 10 },
  { id: "1m", label: "1M", slice: 32 },
];

/** Portfolio value chart — always visible (Portfolio.html). */
export function PortfolioValuePanel({
  chartTotalsPending,
  isMobileViewport,
  dailyChartPoints,
  dailyChartLabels,
  totalValue,
}: {
  chartTotalsPending: boolean;
  isMobileViewport: boolean;
  dailyChartPoints: number[];
  dailyChartLabels: string[];
  totalValue: number;
}) {
  const [period, setPeriod] = useState<PortfolioChartPeriod>("1d");

  const activeSlice = PERIOD_LABELS.find((p) => p.id === period)?.slice ?? 7;

  const { points, labels, chartChangeUsd, chartChangePct } = useMemo(() => {
    if (dailyChartPoints.length === 0) {
      return {
        points: dailyChartPoints,
        labels: dailyChartLabels,
        chartChangeUsd: null as number | null,
        chartChangePct: null as number | null,
      };
    }
    const start = Math.max(0, dailyChartPoints.length - activeSlice);
    const slicedPoints = dailyChartPoints.slice(start);
    const slicedLabels = dailyChartLabels.slice(start);
    const first = slicedPoints[0];
    const last = slicedPoints[slicedPoints.length - 1];
    let chartChangeUsd: number | null = null;
    let chartChangePct: number | null = null;
    if (
      first != null &&
      last != null &&
      Number.isFinite(first) &&
      Number.isFinite(last) &&
      slicedPoints.length >= 2
    ) {
      chartChangeUsd = last - first;
      chartChangePct = first > 0 ? (chartChangeUsd / first) * 100 : null;
    }
    return {
      points: slicedPoints,
      labels: slicedLabels,
      chartChangeUsd,
      chartChangePct,
    };
  }, [dailyChartPoints, dailyChartLabels, activeSlice]);
  const changePositive = (chartChangePct ?? 0) >= 0;
  const showChange =
    chartChangeUsd != null &&
    chartChangePct != null &&
    Number.isFinite(chartChangeUsd) &&
    Number.isFinite(chartChangePct);

  return (
    <div id="portfolio-value-chart" className="pf-chart-panel">
      <div className="pf-chart-panel__head">
        <div>
          <div className="pf-chart-panel__label">Portfolio value</div>
          <div className="pf-chart-panel__value-row">
            {chartTotalsPending ? (
              <span className="inline-block h-8 w-32 animate-pulse rounded bg-white/10" />
            ) : (
              <span className="pf-chart-panel__value">{formatUsdCompact(totalValue)}</span>
            )}
            {showChange && !chartTotalsPending ? (
              <span
                className={`tkl-mono pf-chart-panel__change ${changePositive ? "pf-chart-panel__change--pos" : "pf-chart-panel__change--neg"}`}
              >
                {chartChangeUsd! >= 0 ? "+" : "-"}$
                {Math.abs(chartChangeUsd!).toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}{" "}
                ({chartChangePct! >= 0 ? "+" : ""}
                {chartChangePct!.toFixed(0)}%)
              </span>
            ) : null}
          </div>
        </div>
        <div className="pf-period-group" role="group" aria-label="Chart period">
          {PERIOD_LABELS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pf-period ${period === p.id ? "pf-period--active" : ""}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={
          isMobileViewport ? "pf-chart-panel__canvas pf-chart-panel__canvas--sm" : "pf-chart-panel__canvas"
        }
      >
        {chartTotalsPending ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/5" />
        ) : (
          <PortfolioValueChart
            points={points}
            xLabels={labels}
            compact={isMobileViewport}
            variant="portfolio"
          />
        )}
      </div>
    </div>
  );
}
