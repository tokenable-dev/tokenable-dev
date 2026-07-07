"use client";

import {
  ORDER_BOOK_THREE_COL_GRID,
  orderBookBookSizeColCls,
  orderBookColEndCls,
  orderBookColStartCls,
  orderBookRowValueCls,
} from "@/components/marketplace/price-metrics-strip/theme";
import { formatOrderBookPriceUsdc } from "@/lib/marketplace/unified-order-book";
import type { OrderBookDepthLevel } from "@/lib/marketplace/unified-order-book";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";

export function OrderBookDepthLevelRow({
  side,
  level,
  selectedLevelKey,
  onSelectLevel,
  flush,
  collectionDetail,
}: {
  side: "ask" | "bid";
  level: OrderBookDepthLevel;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
  collectionDetail?: boolean;
}) {
  const isAsk = side === "ask";
  const selected = selectedLevelKey === level.key;
  const selectedRing = isAsk ? "ring-rose-500/50" : "ring-mint/50";
  const priceClass = isAsk ? "text-red-300/95" : "text-zinc-200/95";
  const depthGradient = isAsk
    ? "absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600/35 to-rose-600/[0.07] transition-[width]"
    : "absolute inset-y-0 left-0 bg-gradient-to-r from-mint/35 to-mint/[0.07] transition-[width]";

  const interactive = isAsk;
  const rowClass = collectionDetail
    ? `cd-ob-book-row cd-ob-book-row--${side}${
        selected && interactive ? " cd-ob-book-row--selected" : ""
      }`
    : flush
      ? `relative flex h-[22px] min-h-[22px] max-h-[22px] w-full items-center overflow-hidden rounded-[2px] text-left ${
          interactive ? "cursor-pointer transition-colors focus:outline-none" : "cursor-default"
        } ${selected && interactive ? "bg-white/[0.06] ring-1 " + selectedRing : ""}`
      : `relative min-h-[24px] w-full text-left flex items-center rounded-[2px] overflow-hidden ${
          interactive ? "transition-colors cursor-pointer focus:outline-none" : "cursor-default"
        } ${selected && interactive ? `ring-1 ${selectedRing} bg-white/[0.06]` : ""}`;

  const totalUsdc = level.price * level.count;
  const flushGridClass = `pointer-events-none relative z-10 ${ORDER_BOOK_THREE_COL_GRID} w-full items-center py-0.5 leading-none ${orderBookRowValueCls}`;
  const legacyGridClass = `relative z-10 grid grid-cols-[1fr_44px] gap-1.5 w-full px-2 py-1 items-center leading-none pointer-events-none ${orderBookRowValueCls}`;

  const depthPct = `${Math.min(100, level.depth * 100)}%`;
  const rowBody = collectionDetail ? (
    <>
      <div
        className={`cd-ob-book-row__depth cd-ob-book-row__depth--${side}`}
        style={{
          background: isAsk
            ? `linear-gradient(270deg, rgba(214, 68, 68, 0.3) ${depthPct}, transparent ${depthPct})`
            : `linear-gradient(90deg, rgba(31, 138, 91, 0.32) ${depthPct}, transparent ${depthPct})`,
        }}
      />
      <div className="cd-ob-book-row__grid">
        <span className={`cd-ob-book-row__price cd-ob-book-row__price--${side}`}>
          {formatOrderBookPriceUsdc(level.price)}
        </span>
        <span className="cd-ob-book-row__size">{level.count}</span>
        <span className="cd-ob-book-row__total">
          {formatOrderBookPriceUsdc(totalUsdc)}
        </span>
      </div>
    </>
  ) : (
    <>
      <div
        className={depthGradient}
        style={{ width: depthPct }}
      />
      <div className={flush ? flushGridClass : legacyGridClass}>
        <span className={`${priceClass} ${orderBookColStartCls}`}>
          {formatOrderBookPriceUsdc(level.price)}
        </span>
        <span className={`text-zinc-200/90 ${orderBookBookSizeColCls}`}>{level.count}</span>
        {flush ? (
          <span className={`text-zinc-200/90 ${orderBookColEndCls}`}>
            {formatOrderBookPriceUsdc(totalUsdc)}
          </span>
        ) : null}
      </div>
    </>
  );

  if (!interactive) {
    return (
      <div key={level.key} className={rowClass}>
        {rowBody}
      </div>
    );
  }

  return (
    <button
      key={level.key}
      type="button"
      onClick={() =>
        onSelectLevel?.({
          side,
          levelKey: level.key,
          price: level.price,
          orders: level.orders,
        })
      }
      className={rowClass}
    >
      {rowBody}
    </button>
  );
}
