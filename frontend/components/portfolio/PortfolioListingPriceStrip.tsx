"use client";

import { formatUsdCompact } from "@/lib/market";
import { computeAskVsMarketPct } from "@/lib/portfolio/askVsMarketPct";

const STRIP_MUTED_CLASS = "text-[#8BA1B3]";
const STRIP_TEXT_CLASS = "text-xs leading-tight sm:text-[14px]";
const STRIP_VALUE_CLASS = "font-semibold tabular-nums text-white";

function formatMktDeltaPctLabel(pct: number, direction: "up" | "down" | "flat"): string {
  if (direction === "flat") return `${pct}%`;
  const sign = direction === "up" ? "+" : "-";
  return `${sign}${pct}%`;
}

/** Listings card — `Price: $ask` + signed `% vs Mkt` on one line (design ref). */
export function PortfolioListingPriceStrip({
  askPriceUsd,
  marketPriceUsd,
  marketPending = false,
}: {
  askPriceUsd: number | null;
  marketPriceUsd: number | null;
  marketPending?: boolean;
}) {
  const comparison =
    askPriceUsd != null && marketPriceUsd != null
      ? computeAskVsMarketPct(askPriceUsd, marketPriceUsd)
      : null;

  const priceTitle =
    askPriceUsd != null
      ? `Price: ${formatUsdCompact(askPriceUsd)}`
      : "Price: —";

  const fullTitle =
    comparison && marketPriceUsd != null
      ? `${priceTitle} · ${comparison.pct}% ${comparison.direction === "up" ? "above" : comparison.direction === "down" ? "below" : "at"} market (${formatUsdCompact(marketPriceUsd)})`
      : marketPriceUsd != null && askPriceUsd != null
        ? `${priceTitle} · Market ${formatUsdCompact(marketPriceUsd)}`
        : priceTitle;

  return (
    <p
      className={`flex min-w-0 flex-wrap items-baseline justify-start gap-x-2 gap-y-1 ${STRIP_TEXT_CLASS}`}
      title={fullTitle}
    >
      <span className="inline-flex min-w-0 items-baseline gap-1">
        <span className={STRIP_MUTED_CLASS}>Price:</span>
        <span className={STRIP_VALUE_CLASS}>
          {askPriceUsd != null ? formatUsdCompact(askPriceUsd) : "—"}
        </span>
      </span>

      {askPriceUsd != null && (marketPending || marketPriceUsd != null) ? (
        <span className="inline-flex shrink-0 items-baseline gap-1.5">
          {marketPending && marketPriceUsd == null ? (
            <span
              className="inline-block h-3.5 w-16 animate-pulse rounded bg-zinc-800/80 sm:h-4 sm:w-[4.5rem]"
              aria-hidden
            />
          ) : comparison ? (
            <>
              <span className={`${STRIP_MUTED_CLASS} tabular-nums`}>
                {formatMktDeltaPctLabel(comparison.pct, comparison.direction)}
              </span>
              <span className={STRIP_MUTED_CLASS}>Mkt</span>
            </>
          ) : null}
        </span>
      ) : null}
    </p>
  );
}
