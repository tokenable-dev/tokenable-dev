"use client";

import { COLLECTION_ORDER_BOOK_SCROLL_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import {
  orderBookColumnHeaderCls,
  orderBookTradesContentValueCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import { TradesSourceCell } from "@/components/marketplace/unified-order-book/TradeSourceMark";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  formatTapeDate,
  formatTapeTimeFull,
  formatTradesTapePriceUsdc,
  tapeSideDisplay,
  tapeSourceDisplay,
} from "@/lib/marketplace/unified-order-book";
import { rwaDetailRightFont } from "../theme";

/** Price · Side (narrow) · Source · Time (wider) */
const RWA_TRADES_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(2rem,0.62fr)_minmax(1.75rem,0.55fr)_minmax(3.5rem,1.2fr)] items-center gap-x-3";

const RWA_PRICE_COL = "min-w-0 w-full truncate text-left tabular-nums";
const RWA_SIDE_HDR_COL = "min-w-0 w-full truncate text-center";
/** Data only — nudge left under centered header. */
const RWA_SIDE_DATA_COL = "min-w-0 w-full truncate text-center relative -left-1.5";
const RWA_SOURCE_HDR_COL = "block min-w-0 w-full text-center";
const RWA_SOURCE_DATA_COL =
  "flex w-full min-w-0 items-center justify-center justify-self-center";
const RWA_TIME_HDR_COL = "min-w-0 w-full truncate text-right pr-2";
const RWA_TIME_COL = "min-w-0 w-full truncate text-right tabular-nums";

const RWA_TRADES_HEADER_CLS =
  `shrink-0 border-b border-zinc-800/55 pb-2 ${orderBookColumnHeaderCls}`;

const RWA_TRADES_ROW_CLS =
  `border-b border-zinc-800/40 py-2 last:border-b-0 ${orderBookTradesContentValueCls} text-[13px] text-zinc-200`;

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
    <div className="mt-4 min-w-0 overflow-hidden">
      <div className={`${RWA_TRADES_GRID} ${RWA_TRADES_HEADER_CLS}`}>
        <span className={RWA_PRICE_COL}>Price</span>
        <span className={RWA_SIDE_HDR_COL}>Side</span>
        <span className={RWA_SOURCE_HDR_COL}>Source</span>
        <span className={RWA_TIME_HDR_COL}>Time</span>
      </div>

      <ul
        className={`max-h-[min(280px,40vh)] overflow-y-auto overflow-x-hidden overscroll-y-auto ${COLLECTION_ORDER_BOOK_SCROLL_CLASS}`}
      >
        {trades.map((row) => {
          const side = tapeSideDisplay(row);
          const source = tapeSourceDisplay(row);

          return (
            <li key={row.orderHash} className={`${RWA_TRADES_GRID} ${RWA_TRADES_ROW_CLS}`}>
              <span className={`${RWA_PRICE_COL} font-medium text-mint`}>
                {formatTradesTapePriceUsdc(row.priceUsdc)}
              </span>
              <span
                className={`${RWA_SIDE_DATA_COL} text-[11px] font-semibold uppercase tracking-wide ${side.className}`}
                title={side.title}
              >
                {side.label}
              </span>
              <div className={RWA_SOURCE_DATA_COL}>
                <TradesSourceCell source={source} compact className="!w-auto shrink-0" />
              </div>
              <span
                className={`${RWA_TIME_COL} text-zinc-400`}
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
