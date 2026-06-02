"use client";

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

  const buttonClass = flush
    ? `relative flex min-h-[24px] w-full cursor-pointer items-center overflow-hidden rounded-[2px] text-left transition-colors hover:bg-white/[0.04] focus:outline-none ${
        selected ? "bg-white/[0.06] ring-1 " + selectedRing : ""
      }`
    : `relative min-h-[24px] w-full text-left flex items-center rounded-[2px] overflow-hidden transition-colors cursor-pointer hover:bg-white/[0.04] focus:outline-none ${
        selected ? `ring-1 ${selectedRing} bg-white/[0.06]` : ""
      }`;

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
      className={buttonClass}
    >
      <div
        className={depthGradient}
        style={{ width: `${Math.min(100, level.depth * 100)}%` }}
      />
      <div
        className={
          flush
            ? "pointer-events-none relative z-10 grid w-full grid-cols-[1fr_44px] items-center gap-1.5 px-2 py-1 font-mono text-[11px] tabular-nums leading-none"
            : "relative z-10 grid grid-cols-[1fr_44px] gap-1.5 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center leading-none pointer-events-none"
        }
      >
        <span className={`font-medium ${priceClass}`}>
          {formatOrderBookPriceUsdc(level.price)}
        </span>
        <span className="text-right text-gray-200/90">{level.count}</span>
      </div>
    </button>
  );
}
