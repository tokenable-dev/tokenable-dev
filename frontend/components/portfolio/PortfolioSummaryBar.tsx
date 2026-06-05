"use client";

import { formatUsdCompact } from "@/lib/market";
import { formatSignedPnlAmount } from "@/lib/portfolio/formatSignedPnl";
import { PortfolioChartToggle } from "./PortfolioChartToggle";
import { PortfolioHeaderStat } from "./PortfolioHeaderStat";

function TotalValueBlock({
  chartTotalsPending,
  totalValue,
  dailyPnlPct,
  portfolioChartOpen,
  onToggleChart,
}: {
  chartTotalsPending: boolean;
  totalValue: number;
  dailyPnlPct: number | null;
  portfolioChartOpen: boolean;
  onToggleChart: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:text-xs sm:normal-case sm:tracking-normal sm:text-gray-400">
          Total Value
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
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
        </div>
      </div>
      <PortfolioChartToggle
        open={portfolioChartOpen}
        disabled={chartTotalsPending}
        onToggle={onToggleChart}
      />
    </div>
  );
}

function SummaryStats({
  holdingsCount,
  totalTrades,
  chartTotalsPending,
  hasDailyPnl,
  dailyPnlUsd,
  mobile,
}: {
  holdingsCount: number;
  totalTrades: number;
  chartTotalsPending: boolean;
  hasDailyPnl: boolean;
  dailyPnlUsd: number | null;
  mobile?: boolean;
}) {
  const align = mobile ? "center" : "end";

  return (
    <>
      <PortfolioHeaderStat label="Amount" value={String(holdingsCount)} align={align} />
      <PortfolioHeaderStat
        label={
          mobile ? (
            "Trades"
          ) : (
            <>
              <span className="sm:hidden">Trades</span>
              <span className="hidden sm:inline">Total trades</span>
            </>
          )
        }
        value={String(totalTrades)}
        align={align}
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
        align={align}
      />
    </>
  );
}

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
    <>
      <div className="mb-4 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:hidden">
        <h1 className="text-lg font-extrabold tracking-tight">Portfolio</h1>
        <div className="mt-3">
          <TotalValueBlock
            chartTotalsPending={chartTotalsPending}
            totalValue={totalValue}
            dailyPnlPct={dailyPnlPct}
            portfolioChartOpen={portfolioChartOpen}
            onToggleChart={onToggleChart}
          />
        </div>
        <div
          className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-800/80 pt-4"
          role="group"
          aria-label="Portfolio summary"
        >
          <SummaryStats
            holdingsCount={holdingsCount}
            totalTrades={totalTrades}
            chartTotalsPending={chartTotalsPending}
            hasDailyPnl={hasDailyPnl}
            dailyPnlUsd={dailyPnlUsd}
            mobile
          />
        </div>
      </div>

      <div className="mb-4 hidden flex-wrap items-end justify-between gap-x-4 gap-y-4 sm:mb-5 sm:flex sm:gap-x-6 lg:mb-6">
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
          <SummaryStats
            holdingsCount={holdingsCount}
            totalTrades={totalTrades}
            chartTotalsPending={chartTotalsPending}
            hasDailyPnl={hasDailyPnl}
            dailyPnlUsd={dailyPnlUsd}
          />
        </div>
      </div>
    </>
  );
}
