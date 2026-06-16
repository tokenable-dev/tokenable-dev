"use client";

import { COLLECTION_ORDER_BOOK_SCROLL_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import { TradeSourceMark } from "@/components/marketplace/unified-order-book/TradeSourceMark";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  formatTapeDate,
  formatTapeTimeFull,
  formatTradesTapePriceUsdc,
  tapeSideDisplay,
  tapeSourceDisplay,
} from "@/lib/marketplace/unified-order-book";
import { rwaDetailRightFont } from "../theme";

/** Equal quarters — Price | Side | Source | Time */
const RWA_TRADES_GRID = "grid grid-cols-4 items-center gap-x-1";

const RWA_TRADES_COL = "min-w-0 truncate text-center";

const RWA_TRADES_HEADER_CLS =
  "border-b border-[rgba(38,39,45,1)] pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500";

const RWA_TRADES_ROW_CLS =
  "border-b border-[rgba(38,39,45,0.45)] py-2.5 text-[14px] tabular-nums last:border-b-0";

function RwaTradesTable({
  trades,
  loading,
  emptyLabel,
}: {
  trades: CollectionPlatformTapeFill[];
  loading: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="mt-4 space-y-2.5" role="status" aria-live="polite" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-md bg-zinc-900/80"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <p className="mt-4 text-[14px] leading-relaxed text-zinc-500">{emptyLabel}</p>
    );
  }

  return (
    <div className="mt-4 min-w-0">
      <div className={`${RWA_TRADES_GRID} ${RWA_TRADES_HEADER_CLS}`}>
        <span className={RWA_TRADES_COL}>Price</span>
        <span className={RWA_TRADES_COL}>Side</span>
        <span className={RWA_TRADES_COL}>Source</span>
        <span className={`${RWA_TRADES_COL} relative -left-1 sm:-left-1.5`}>Time</span>
      </div>

      <ul
        className={`max-h-[min(280px,40vh)] space-y-0 overflow-y-auto overflow-x-hidden overscroll-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS}`}
      >
        {trades.map((row) => {
          const side = tapeSideDisplay(row);
          const source = tapeSourceDisplay(row);

          return (
            <li key={row.orderHash} className={`${RWA_TRADES_GRID} ${RWA_TRADES_ROW_CLS}`}>
              <span className={`${RWA_TRADES_COL} font-medium text-mint`}>
                {formatTradesTapePriceUsdc(row.priceUsdc)}
              </span>
              <span
                className={`${RWA_TRADES_COL} text-[11px] font-semibold uppercase tracking-wide ${side.className}`}
                title={side.title}
              >
                {side.label}
              </span>
              <TradeSourceMark
                source={source}
                compact
                className={`${RWA_TRADES_COL} justify-self-center`}
              />
              <span
                className={`${RWA_TRADES_COL} text-[13px] tabular-nums text-zinc-500`}
                title={formatTapeTimeFull(row.t)}
              >
                {formatTapeDate(row.t)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
      className={`${rwaDetailRightFont.className} min-w-0 w-full ${className}`}
      aria-label="Trades"
    >
      <h2 className="text-[18px] font-bold leading-[140%] tracking-normal text-white">
        Trades
      </h2>

      {!tradesAvailable ? (
        <p className="mt-4 text-[14px] leading-relaxed text-zinc-500">
          Trades appear when this card is linked to a collection.
        </p>
      ) : (
        <RwaTradesTable
          trades={trades}
          loading={loading}
          emptyLabel="No trades yet"
        />
      )}
    </section>
  );
}
