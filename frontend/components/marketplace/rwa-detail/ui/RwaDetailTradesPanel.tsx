"use client";

import { COLLECTION_ORDER_BOOK_SCROLL_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import { orderBookColumnHeaderCls } from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  TRADES_TAPE_FLUSH_HEADER_CLASS,
  TRADES_TAPE_SCROLL_HEIGHT_CLASS,
} from "@/lib/marketplace/unified-order-book/tradesTapeTableChrome";
import {
  RWA_TRADES_PRICE_COL,
  RWA_TRADES_SIDE_HDR_COL,
  RWA_TRADES_SOURCE_HDR_COL,
  RWA_TRADES_TAPE_GRID,
  RWA_TRADES_TIME_HDR_COL,
  TradesTapeScrollList,
} from "@/components/marketplace/unified-order-book/TradesTapeScrollList";
import { rwaDetailRightFont } from "../theme";

const RWA_TRADES_HEADER_CLS =
  `shrink-0 ${TRADES_TAPE_FLUSH_HEADER_CLASS} ${orderBookColumnHeaderCls}`;

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
      <div className="mt-3 space-y-2" role="status" aria-live="polite" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded-md bg-zinc-900/80"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">{emptyLabel}</p>
    );
  }

  return (
    <div className="mt-3 min-w-0 overflow-hidden">
      <div className={`${RWA_TRADES_TAPE_GRID} ${RWA_TRADES_HEADER_CLS}`}>
        <span className={RWA_TRADES_PRICE_COL}>Price</span>
        <span className={RWA_TRADES_SIDE_HDR_COL}>Side</span>
        <span className={RWA_TRADES_SOURCE_HDR_COL}>Source</span>
        <span className={RWA_TRADES_TIME_HDR_COL}>Time</span>
      </div>

      <TradesTapeScrollList
        tapeFills={trades}
        flush
        scrollClass={COLLECTION_ORDER_BOOK_SCROLL_CLASS}
        maxHeightClass={TRADES_TAPE_SCROLL_HEIGHT_CLASS}
      />
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
        <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
          Trades unavailable for this token.
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
