"use client";

import { formatUsdCompact } from "@/lib/market";
import { PortfolioChartToggle } from "./PortfolioChartToggle";

const BROWSER_VALUE_TEXT_SIZE_CLASS =
  "text-xl font-extrabold tracking-tight sm:text-2xl lg:text-3xl";
/** Match {@link BROWSER_VALUE_TEXT_SIZE_CLASS} cap height for inline chart icon. */
export const BROWSER_VALUE_CHART_ICON_SIZE_CLASS =
  "h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12";
const BROWSER_VALUE_LABEL_CLASS = `shrink-0 ${BROWSER_VALUE_TEXT_SIZE_CLASS} text-white`;
const BROWSER_VALUE_AMOUNT_CLASS = `shrink-0 tabular-nums ${BROWSER_VALUE_TEXT_SIZE_CLASS} text-white`;
const BROWSER_VALUE_PCT_POSITIVE_CLASS = `shrink-0 tabular-nums ${BROWSER_VALUE_TEXT_SIZE_CLASS} text-mint`;
const BROWSER_VALUE_PCT_NEGATIVE_CLASS = `shrink-0 tabular-nums ${BROWSER_VALUE_TEXT_SIZE_CLASS} text-red-400`;

/** Desktop/browser — Portfolio value, price, change %, chart toggle only. */
export function PortfolioBrowserSummaryHeader({
  totalValue,
  dailyPnlPct,
  chartTotalsPending,
  portfolioChartOpen,
  onToggleChart,
}: {
  totalValue: number;
  dailyPnlPct: number | null;
  chartTotalsPending: boolean;
  portfolioChartOpen: boolean;
  onToggleChart: () => void;
}) {
  const summaryAria = chartTotalsPending
    ? "Portfolio value loading"
    : [
        "Portfolio value",
        formatUsdCompact(totalValue),
        dailyPnlPct != null && dailyPnlPct !== 0
          ? `${dailyPnlPct >= 0 ? "+" : ""}${dailyPnlPct.toFixed(1)}%`
          : null,
      ]
        .filter(Boolean)
        .join(", ");

  return (
    <header
      className="mb-4 hidden min-w-0 sm:mb-5 sm:flex sm:items-center lg:mb-6"
      aria-label={summaryAria}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-2.5">
        <span className={BROWSER_VALUE_LABEL_CLASS}>Portfolio value:</span>

        {chartTotalsPending ? (
          <span
            className="inline-block h-7 w-24 shrink-0 animate-pulse rounded-lg bg-gray-800/80 sm:h-8 sm:w-28"
            aria-hidden
          />
        ) : (
          <>
            <span className={BROWSER_VALUE_AMOUNT_CLASS}>
              {formatUsdCompact(totalValue)}
            </span>
            {dailyPnlPct != null && dailyPnlPct !== 0 ? (
              <span
                className={
                  dailyPnlPct >= 0
                    ? BROWSER_VALUE_PCT_POSITIVE_CLASS
                    : BROWSER_VALUE_PCT_NEGATIVE_CLASS
                }
              >
                {dailyPnlPct >= 0 ? "+" : ""}
                {dailyPnlPct.toFixed(1)}%
              </span>
            ) : null}
          </>
        )}

        <PortfolioChartToggle
          variant="inline"
          iconClassName={BROWSER_VALUE_CHART_ICON_SIZE_CLASS}
          open={portfolioChartOpen}
          disabled={chartTotalsPending}
          onToggle={onToggleChart}
        />
      </div>
    </header>
  );
}
