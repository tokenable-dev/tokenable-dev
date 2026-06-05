"use client";

import {
  ORDER_BOOK_THREE_COL_GRID,
  orderBookColEndCls,
  orderBookColMidCls,
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
}: {
  side: "ask" | "bid";
  level: OrderBookDepthLevel;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
}) {
  const isAsk = side === "ask";
  const selected = selectedLevelKey === level.key;
  const selectedRing = isAsk ? "ring-rose-500/50" : "ring-mint/50";
  const priceClass = isAsk ? "text-red-300/95" : "text-zinc-200/95";
  const depthGradient = isAsk
    ? "absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600/35 to-rose-600/[0.07] transition-[width]"
    : "absolute inset-y-0 left-0 bg-gradient-to-r from-mint/35 to-mint/[0.07] transition-[width]";

  const interactive = isAsk;
  const rowClass = flush
    ? `relative flex h-[25px] min-h-[25px] max-h-[25px] w-full items-center overflow-hidden rounded-[2px] text-left ${
        interactive ? "cursor-pointer transition-colors focus:outline-none" : "cursor-default"
      } ${selected && interactive ? "bg-white/[0.06] ring-1 " + selectedRing : ""}`
    : `relative min-h-[24px] w-full text-left flex items-center rounded-[2px] overflow-hidden ${
        interactive ? "transition-colors cursor-pointer focus:outline-none" : "cursor-default"
      } ${selected && interactive ? `ring-1 ${selectedRing} bg-white/[0.06]` : ""}`;

  const totalUsdc = level.price * level.count;
  const flushGridClass = `pointer-events-none relative z-10 ${ORDER_BOOK_THREE_COL_GRID} w-full items-center px-2 py-0.5 leading-none ${orderBookRowValueCls}`;
  const legacyGridClass = `relative z-10 grid grid-cols-[1fr_44px] gap-1.5 w-full px-2 py-1 items-center leading-none pointer-events-none ${orderBookRowValueCls}`;

  const rowBody = (
    <>
      <div
        className={depthGradient}
        style={{ width: `${Math.min(100, level.depth * 100)}%` }}
      />
      <div className={flush ? flushGridClass : legacyGridClass}>
        <span className={`${priceClass} ${orderBookColStartCls}`}>
          {formatOrderBookPriceUsdc(level.price)}
        </span>
        <span className={`text-zinc-200/90 ${orderBookColMidCls}`}>{level.count}</span>
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
