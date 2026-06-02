"use client";

import { PortfolioValueChart } from "./PortfolioValueChart";

/** Expandable value history chart — total value lives in {@link PortfolioSummaryBar}. */
export function PortfolioValuePanel({
  chartTotalsPending,
  portfolioChartOpen,
  isMobileViewport,
  dailyChartPoints,
  dailyChartLabels,
}: {
  chartTotalsPending: boolean;
  portfolioChartOpen: boolean;
  isMobileViewport: boolean;
  dailyChartPoints: number[];
  dailyChartLabels: string[];
}) {
  return (
    <div
      id="portfolio-value-chart"
      className={`grid w-full transition-[grid-template-rows,margin] duration-300 ease-out ${
        portfolioChartOpen
          ? "mb-6 grid-rows-[auto] sm:mb-8"
          : "mb-0 grid-rows-[0fr]"
      }`}
      aria-hidden={!portfolioChartOpen}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={`rounded-2xl border border-gray-800 bg-gray-900/40 p-3 sm:p-4 ${
            portfolioChartOpen ? "opacity-100" : "opacity-0"
          } transition-opacity duration-300`}
        >
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
