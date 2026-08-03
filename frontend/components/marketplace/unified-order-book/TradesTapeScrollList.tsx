"use client";

import {
  ORDER_BOOK_TRADES_FOUR_COL_GRID,
  orderBookColEndCls,
  orderBookColMidCls,
  orderBookTradesContentValueCls,
  orderBookTradesPriceDataColCls,
  orderBookTradesSideDataColCls,
  orderBookTradesSideColCls,
  orderBookTradesSourceDataCellCls,
  orderBookTradesSourceHeaderColCls,
  orderBookTradesTimeColCls,
  orderBookTradesTimeHeaderColCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import {
  formatTapeDate,
  formatTapeTimeFull,
  formatTradesTapePriceUsdc,
  tapeSideDisplay,
  tapeSourceDisplay,
  tradesTapePriceClassName,
  tradesTapePriceCompareTone,
} from "@/lib/marketplace/unified-order-book";
import { TRADES_TAPE_FLUSH_ROW_CLASS, TRADES_TAPE_SCROLL_HEIGHT_CLASS } from "@/lib/marketplace/unified-order-book/tradesTapeTableChrome";
import { TradesSourceCell } from "./TradeSourceMark";

const TRADES_GRID_LEGACY =
  "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,3.25rem)_minmax(0,2.5rem)_minmax(4.75rem,5.5rem)] gap-x-2";

export function TradesTapeScrollList({
  tapeFills,
  flush,
  collectionDetail,
  insetXClass = "",
  scrollClass = "",
  maxHeightClass,
}: {
  tapeFills: CollectionPlatformTapeFill[];
  flush: boolean;
  collectionDetail?: boolean;
  insetXClass?: string;
  scrollClass?: string;
  maxHeightClass?: string;
}) {
  const gridClass = flush ? ORDER_BOOK_TRADES_FOUR_COL_GRID : TRADES_GRID_LEGACY;
  const rowGridClass = collectionDetail
    ? "cd-ob-trades-row"
    : flush
      ? `${ORDER_BOOK_TRADES_FOUR_COL_GRID} items-center`
      : `${gridClass} items-center`;
  const scrollHeightClass =
    maxHeightClass ?? (flush ? TRADES_TAPE_SCROLL_HEIGHT_CLASS : "");

  return (
    <div
      className={[
        "min-h-0 shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-auto",
        collectionDetail ? "cd-ob-trades-scroll" : insetXClass,
        scrollClass,
        !collectionDetail ? scrollHeightClass : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tapeFills.map((row, index) => {
        const side = tapeSideDisplay(row);
        const source = tapeSourceDisplay(row);
        const priceTone = tradesTapePriceCompareTone(
          row.priceUsdc,
          tapeFills[index + 1]?.priceUsdc,
        );
        const priceClass = collectionDetail
          ? priceTone === "down"
            ? "cd-ob-trades-price cd-ob-trades-price--down"
            : "cd-ob-trades-price cd-ob-trades-price--up"
          : tradesTapePriceClassName(priceTone);

        return (
          <div
            key={row.orderHash}
            className={`${rowGridClass} ${
              collectionDetail
                ? ""
                : flush
                  ? TRADES_TAPE_FLUSH_ROW_CLASS
                  : `${orderBookTradesContentValueCls} py-0.5 text-zinc-200`
            }`}
          >
            <span
              className={
                collectionDetail
                  ? priceClass
                  : `min-w-0 truncate ${orderBookTradesPriceDataColCls} ${priceClass}`
              }
            >
              {formatTradesTapePriceUsdc(row.priceUsdc)}
            </span>
            {flush ? (
              <>
                <span
                  className={
                    collectionDetail
                      ? "cd-ob-trades-side"
                      : `min-w-0 truncate ${orderBookTradesSideDataColCls} ${side.className}`
                  }
                  title={side.title}
                >
                  {side.label}
                </span>
                {collectionDetail ? (
                  <TradesSourceCell
                    source={source}
                    className="cd-ob-trades-source"
                    collectionDetail
                  />
                ) : (
                  <TradesSourceCell
                    source={source}
                    className={orderBookTradesSourceDataCellCls}
                  />
                )}
                <span
                  className={
                    collectionDetail
                      ? "cd-ob-trades-time"
                      : `min-w-0 truncate ${orderBookTradesTimeColCls} text-zinc-400`
                  }
                  title={formatTapeTimeFull(row.t)}
                >
                  {formatTapeDate(row.t)}
                </span>
              </>
            ) : (
              <>
                <span
                  className={`min-w-0 truncate ${orderBookColMidCls} pl-1 sm:pl-1.5 ${side.className}`}
                  title={side.title}
                >
                  {side.label}
                </span>
                <TradesSourceCell
                  source={source}
                  className={orderBookTradesSourceDataCellCls}
                />
                <span className={`${orderBookColEndCls} text-zinc-500`}>#{row.tokenId}</span>
                <span
                  className={`min-w-0 truncate ${orderBookTradesTimeColCls} text-zinc-400`}
                  title={formatTapeTimeFull(row.t)}
                >
                  {formatTapeDate(row.t)}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** RWA card detail — same columns as collection flush Trades tab. */
export const RWA_TRADES_TAPE_GRID = ORDER_BOOK_TRADES_FOUR_COL_GRID;

export const RWA_TRADES_PRICE_COL = "min-w-0 w-full truncate text-left tabular-nums";
export const RWA_TRADES_SIDE_HDR_COL = "min-w-0 w-full truncate text-center";
export const RWA_TRADES_SIDE_DATA_COL =
  "min-w-0 w-full truncate text-center relative -left-1.5 text-xs font-semibold uppercase tracking-wide";
export const RWA_TRADES_SOURCE_HDR_COL = orderBookTradesSourceHeaderColCls;
export const RWA_TRADES_SOURCE_DATA_COL =
  "flex w-full min-w-0 items-center justify-center justify-self-center";
export const RWA_TRADES_TIME_HDR_COL = `${orderBookTradesTimeHeaderColCls} pr-0`;
export const RWA_TRADES_TIME_COL = `${orderBookTradesTimeColCls} text-zinc-400`;
