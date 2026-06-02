"use client";

import { formatUsdCompact } from "@/lib/market";
import { PortfolioChartToggle } from "./PortfolioChartToggle";
import { PortfolioValueChart } from "./PortfolioValueChart";

export function PortfolioValuePanel({
  totalValue,
  dailyPnlPct,
  chartTotalsPending,
  portfolioChartOpen,
  onToggleChart,
  isMobileViewport,
  dailyChartPoints,
  dailyChartLabels,
}: {
  totalValue: number;
  dailyPnlPct: number | null;
  chartTotalsPending: boolean;
  portfolioChartOpen: boolean;
  onToggleChart: () => void;
  isMobileViewport: boolean;
  dailyChartPoints: number[];
  dailyChartLabels: string[];
}) {
  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 p-3 sm:p-6">
      <p className="mb-2 text-xs font-medium text-gray-500 sm:mb-3 sm:text-sm sm:text-gray-400">
        Total Value
      </p>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
          {chartTotalsPending ? (
            <span className="inline-block h-8 w-24 animate-pulse rounded-lg bg-gray-800/80 sm:h-9 sm:w-28" />
          ) : (
            <>
              <span className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {formatUsdCompact(totalValue)}
              </span>
              {dailyPnlPct != null && dailyPnlPct !== 0 && (
                <span
                  className={`text-sm font-bold tabular-nums sm:text-base ${
                    dailyPnlPct >= 0 ? "text-mint" : "text-red-400"
                  }`}
                >
                  {dailyPnlPct >= 0 ? "+" : ""}
                  {dailyPnlPct.toFixed(1)}%
                </span>
              )}
            </>
          )}
        </div>
        <div className="shrink-0 border-l border-gray-800/80 pl-3 sm:pl-4">
          <PortfolioChartToggle
            open={portfolioChartOpen}
            disabled={chartTotalsPending}
            onToggle={onToggleChart}
          />
        </div>
      </div>
      <div
        id="portfolio-value-chart"
        className={`grid w-full transition-[grid-template-rows,margin] duration-300 ease-out ${
          portfolioChartOpen ? "mt-4 grid-rows-[auto] sm:mt-5" : "mt-0 grid-rows-[0fr]"
        }`}
        aria-hidden={!portfolioChartOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={
              isMobileViewport ? "h-[228px] w-full" : "h-[240px] w-full lg:h-[280px]"
            }
          >
            {chartTotalsPending ? (
              <div className="h-full w-full animate-pulse rounded-lg bg-gray-800/40" />
            ) : (
              <PortfolioValueChart
                points={dailyChartPoints}
                xLabels={dailyChartLabels}
                compact={isMobileViewport}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
