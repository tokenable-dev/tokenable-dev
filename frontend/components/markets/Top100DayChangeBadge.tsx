"use client";

import type { Top100DayChange } from "@/lib/markets/top100DayChanges";
import { formatTop100Usd } from "@/lib/markets/top100CardDisplay";

function formatPct(pct: number): string {
  const abs = Math.abs(pct);
  return `${pct >= 0 ? "+" : "−"}${abs.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function Top100DayChangeBadge({
  change,
  variant = "compact",
  loading = false,
}: {
  change?: Top100DayChange;
  variant?: "compact" | "detail";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span
        className={`inline-block animate-pulse rounded-md bg-zinc-800/80 ${
          variant === "detail" ? "h-5 w-28" : "h-4 w-16"
        }`}
        aria-hidden
      />
    );
  }

  if (!change) return null;

  if (change.isNew) {
    return (
      <span className="inline-flex items-center rounded-[5px] border border-mint/30 bg-mint/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint">
        New
      </span>
    );
  }

  const rankImproved = change.rankDelta != null && change.rankDelta > 0;
  const rankDropped = change.rankDelta != null && change.rankDelta < 0;
  const priceUp = change.priceDelta != null && change.priceDelta > 0;
  const priceDown = change.priceDelta != null && change.priceDelta < 0;
  const flatPrice = change.priceDelta === 0;

  const rankClass = rankImproved
    ? "text-pos"
    : rankDropped
      ? "text-neg"
      : "text-zinc-500";

  const priceClass = priceUp
    ? "text-pos"
    : priceDown
      ? "text-neg"
      : "text-zinc-500";

  if (variant === "detail") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {change.rankDelta != null && change.rankDelta !== 0 ? (
          <span className={`text-sm font-semibold tabular-nums ${rankClass}`}>
            {rankImproved ? "▲" : "▼"} {Math.abs(change.rankDelta)} rank
            {Math.abs(change.rankDelta) !== 1 ? "s" : ""}
            {change.yesterdayRank != null ? (
              <span className="ml-1 font-normal text-zinc-500">
                (was #{change.yesterdayRank})
              </span>
            ) : null}
          </span>
        ) : change.rankDelta === 0 ? (
          <span className="text-sm text-zinc-500">Rank unchanged</span>
        ) : null}
        {change.priceDelta != null ? (
          <span className={`text-sm font-semibold tabular-nums ${priceClass}`}>
            {priceUp ? "+" : priceDown ? "−" : ""}
            {formatTop100Usd(Math.abs(change.priceDelta))}
            {change.priceDeltaPct != null && !flatPrice
              ? ` (${formatPct(change.priceDeltaPct)})`
              : flatPrice
                ? " (flat)"
                : ""}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
      {change.rankDelta != null && change.rankDelta !== 0 ? (
        <span className={`text-[10px] font-semibold tabular-nums ${rankClass}`}>
          {rankImproved ? "▲" : "▼"}
          {Math.abs(change.rankDelta)}
        </span>
      ) : null}
      {change.priceDeltaPct != null && change.priceDeltaPct !== 0 ? (
        <span className={`text-[10px] font-semibold tabular-nums ${priceClass}`}>
          {formatPct(change.priceDeltaPct)}
        </span>
      ) : change.priceDelta === 0 ? (
        <span className="text-[10px] text-zinc-600">—</span>
      ) : null}
    </span>
  );
}
