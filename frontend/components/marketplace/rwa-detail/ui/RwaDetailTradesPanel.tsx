"use client";

import type { CollectionPlatformTapeFill } from "@/lib/core";
import { formatTapeDate, formatTapeTimeFull, tapeSideDisplay } from "@/lib/marketplace/unified-order-book";
import { rwaDetailRightFont } from "../theme";

export function RwaDetailTradesPanel({
  trades,
  loading,
  tradesAvailable,
  className = "",
}: {
  trades: CollectionPlatformTapeFill[];
  loading: boolean;
  tradesAvailable: boolean;
  className?: string;
}) {
  return (
    <section
      className={`${rwaDetailRightFont.className} ${className}`}
      aria-label="Trades"
    >
      <h2 className="text-[18px] font-bold leading-[140%] tracking-normal text-white">
        Trades
      </h2>

      {!tradesAvailable ? (
        <p className="mt-4 text-[14px] leading-relaxed text-zinc-500">
          Trades appear when this card is linked to a collection.
        </p>
      ) : loading ? (
        <div className="mt-4 space-y-2.5" role="status" aria-live="polite" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-zinc-900/80"
              aria-hidden
            />
          ))}
        </div>
      ) : trades.length === 0 ? (
        <p className="mt-4 text-[14px] leading-relaxed text-zinc-500">
          No trades recorded for this card yet.
        </p>
      ) : (
        <div className="mt-4 min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(4.75rem,5.5rem)] gap-2 border-b border-[rgba(38,39,45,1)] pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <span>Price</span>
            <span className="text-center">Type</span>
            <span className="text-right">Time</span>
          </div>
          <ul className="scrollbar-dark max-h-[min(280px,40vh)] space-y-0 overflow-y-auto overflow-x-hidden overscroll-y-auto">
            {trades.map((row) => {
              const side = tapeSideDisplay(row);
              return (
              <li
                key={row.orderHash}
                className="grid grid-cols-[minmax(0,1fr)_auto_minmax(4.75rem,5.5rem)] items-center gap-2 border-b border-[rgba(38,39,45,0.45)] py-2.5 text-[14px] tabular-nums last:border-b-0"
              >
                <span className="min-w-0 truncate font-medium text-mint">
                  {row.priceUsdc.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`min-w-0 truncate text-center text-[11px] font-semibold uppercase tracking-wide ${side.className}`}
                  title={side.title}
                >
                  {side.label}
                </span>
                <span
                  className="min-w-0 truncate text-right text-[13px] tabular-nums text-zinc-500"
                  title={formatTapeTimeFull(row.t)}
                >
                  {formatTapeDate(row.t)}
                </span>
              </li>
            );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
