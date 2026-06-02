"use client";

import { formatUsdCompact } from "@/lib/market";
import { formatSignedPnlAmount } from "@/lib/portfolio/formatSignedPnl";
import { PortfolioChartToggle } from "./PortfolioChartToggle";
import { PortfolioHeaderStat } from "./PortfolioHeaderStat";

export function PortfolioSummaryBar({
  holdingsCount,
  totalTrades,
  totalValue,
  dailyPnlPct,
  chartTotalsPending,
  hasDailyPnl,
  dailyPnlUsd,
  portfolioChartOpen,
  onToggleChart,
}: {
  holdingsCount: number;
  totalTrades: number;
  totalValue: number;
  dailyPnlPct: number | null;
  chartTotalsPending: boolean;
  hasDailyPnl: boolean;
  dailyPnlUsd: number | null;
  portfolioChartOpen: boolean;
  onToggleChart: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-4 sm:mb-5 sm:gap-x-6 lg:mb-6">
      <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3 sm:gap-x-8 lg:gap-x-10">
        <h1 className="shrink-0 text-xl font-extrabold tracking-tight sm:text-3xl">Portfolio</h1>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-500 sm:text-xs sm:text-gray-400">
            Total Value
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
            {chartTotalsPending ? (
              <span className="inline-block h-7 w-24 animate-pulse rounded-lg bg-gray-800/80 sm:h-8 sm:w-28" />
            ) : (
              <>
                <span className="text-xl font-extrabold tracking-tight text-white sm:text-2xl lg:text-3xl">
                  {formatUsdCompact(totalValue)}
                </span>
                {dailyPnlPct != null && dailyPnlPct !== 0 ? (
                  <span
                    className={`text-xs font-bold tabular-nums sm:text-sm ${
                      dailyPnlPct >= 0 ? "text-mint" : "text-red-400"
                    }`}
                  >
                    {dailyPnlPct >= 0 ? "+" : ""}
                    {dailyPnlPct.toFixed(1)}%
                  </span>
                ) : null}
              </>
            )}
            <PortfolioChartToggle
              open={portfolioChartOpen}
              disabled={chartTotalsPending}
              onToggle={onToggleChart}
            />
          </div>
        </div>
      </div>
      <div
        className="ml-auto flex shrink-0 items-end gap-3 sm:gap-x-12 lg:gap-x-16"
        role="group"
        aria-label="Portfolio summary"
      >
        <PortfolioHeaderStat label="Amount" value={String(holdingsCount)} />
        <PortfolioHeaderStat
          label={
            <>
              <span className="sm:hidden">Trades</span>
              <span className="hidden sm:inline">Total trades</span>
            </>
          }
          value={String(totalTrades)}
        />
        <PortfolioHeaderStat
          label="P&L"
          value={
            chartTotalsPending
              ? "…"
              : !hasDailyPnl
                ? "—"
                : formatSignedPnlAmount(dailyPnlUsd!)
          }
          tone={
            chartTotalsPending || !hasDailyPnl
              ? "neutral"
              : dailyPnlUsd! > 0
                ? "positive"
                : dailyPnlUsd! < 0
                  ? "negative"
                  : "neutral"
          }
        />
      </div>
    </div>
  );
}
