"use client";

import { formatSignedPnlAmount } from "@/lib/portfolio/formatSignedPnl";
import { PortfolioHeaderStat } from "./PortfolioHeaderStat";

export function PortfolioSummaryBar({
  holdingsCount,
  totalTrades,
  chartTotalsPending,
  hasDailyPnl,
  dailyPnlUsd,
}: {
  holdingsCount: number;
  totalTrades: number;
  chartTotalsPending: boolean;
  hasDailyPnl: boolean;
  dailyPnlUsd: number | null;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-2 sm:mb-10 sm:gap-8">
      <h1 className="shrink-0 text-xl font-extrabold tracking-tight sm:text-3xl">Portfolio</h1>
      <div
        className="flex shrink-0 items-end gap-3 sm:gap-x-16 lg:gap-x-20"
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
