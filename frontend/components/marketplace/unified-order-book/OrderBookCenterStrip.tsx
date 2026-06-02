"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_Y,
} from "@/components/marketplace/collectionOverviewChrome";
import type { BookCenterModel } from "@/lib/marketplace/unified-order-book";

export function OrderBookCenterStrip({ model }: { model: BookCenterModel }) {
  const isSpreadPrimary = model.primary.includes("Spread value:");
  const isNaPlaceholder = model.primary === "N/A";
  const isLastTrade = model.tone === "last";
  const primaryClass = isSpreadPrimary
    ? "text-zinc-200"
    : model.tone === "none"
      ? "text-gray-500"
      : model.tone === "ask"
        ? "text-red-400"
        : model.tone === "bid"
          ? "text-mint"
          : model.tone === "last" && model.lastSide === "sell"
            ? "text-rose-400"
            : "text-mint";

  const showUp =
    !isSpreadPrimary &&
    !isNaPlaceholder &&
    (model.tone === "bid" || (model.tone === "last" && model.lastSide === "buy"));
  const showDown =
    !isSpreadPrimary &&
    !isNaPlaceholder &&
    (model.tone === "ask" || (model.tone === "last" && model.lastSide === "sell"));

  const hasCaption = model.caption.trim().length > 0;

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center ${
        isNaPlaceholder ? "gap-0 px-2 py-0" : "gap-0.5 px-2 py-1"
      } ${COLLECTION_DETAILS_BORDER_Y} ${COLLECTION_DETAILS_BG_CLASS} ${
        hasCaption
          ? "min-h-[1.875rem]"
          : isNaPlaceholder
            ? "min-h-0"
            : isLastTrade
              ? "min-h-[1.25rem]"
              : isSpreadPrimary
                ? "min-h-[1.5rem]"
                : "min-h-[1.75rem]"
      }`}
      title={model.title}
    >
      <div
        className={`flex flex-wrap items-center justify-center ${
          isNaPlaceholder ? "gap-x-1" : "gap-x-2.5 gap-y-1"
        }`}
      >
        <div className="flex items-center gap-1">
          {showUp ? (
            <span
              className={`font-bold leading-none text-mint/90 ${isLastTrade ? "text-xs" : "text-base"}`}
              aria-hidden
            >
              ↑
            </span>
          ) : null}
          {showDown ? (
            <span
              className={`font-bold leading-none text-rose-400/90 ${isLastTrade ? "text-xs" : "text-base"}`}
              aria-hidden
            >
              ↓
            </span>
          ) : null}
          <span
            className={`tabular-nums tracking-tight ${
              isNaPlaceholder
                ? "text-[10px] font-medium leading-none text-zinc-500"
                : isSpreadPrimary
                  ? "max-w-[min(100%,17rem)] px-0.5 text-center text-[11px] font-semibold leading-snug sm:text-xs"
                  : isLastTrade
                    ? `text-[13px] font-semibold leading-none sm:text-sm ${primaryClass}`
                    : `text-xl font-bold sm:text-2xl ${primaryClass}`
            }`}
          >
            {model.primary}
          </span>
        </div>
        {model.secondary != null ? (
          <span className="max-w-[min(100%,220px)] truncate text-[11px] font-mono tabular-nums text-zinc-500 sm:max-w-none">
            {model.secondary}
          </span>
        ) : null}
      </div>
      {hasCaption ? (
        <p className="line-clamp-2 flex h-[2.5rem] w-full items-center justify-center px-1 text-center text-[9px] leading-snug text-zinc-600">
          {model.caption}
        </p>
      ) : null}
    </div>
  );
}
