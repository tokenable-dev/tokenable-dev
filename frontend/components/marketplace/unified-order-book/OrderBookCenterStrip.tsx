"use client";

import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import { orderBookRowValueCls } from "@/components/marketplace/price-metrics-strip/theme";
import type { BookCenterModel } from "@/lib/marketplace/unified-order-book";

export function OrderBookCenterStrip({
  model,
  collectionDetail,
}: {
  model: BookCenterModel;
  collectionDetail?: boolean;
}) {
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

  if (collectionDetail && isNaPlaceholder) {
    return (
      <div className="cd-ob-book-center__na" title={model.title}>
        N/A
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center ${
        isNaPlaceholder ? "gap-0 px-2 py-0" : "gap-0.5 px-2 py-1"
      } ${collectionDetail ? "cd-ob-book-center__strip" : COLLECTION_DETAILS_BG_CLASS} ${
        hasCaption
          ? "min-h-[1.875rem]"
          : isNaPlaceholder
            ? "min-h-0"
            : isLastTrade
              ? "min-h-[1.75rem]"
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
              className="text-[13px] font-bold leading-none text-mint/90 lg:text-[15px]"
              aria-hidden
            >
              ↑
            </span>
          ) : null}
          {showDown ? (
            <span
              className="text-[13px] font-bold leading-none text-rose-400/90 lg:text-[15px]"
              aria-hidden
            >
              ↓
            </span>
          ) : null}
          <span
            className={`tabular-nums tracking-tight ${orderBookRowValueCls} ${
              isNaPlaceholder
                ? "text-zinc-500"
                : isSpreadPrimary
                  ? "max-w-[min(100%,17rem)] px-0.5 text-center text-zinc-200"
                  : primaryClass
            }`}
          >
            {model.primary}
          </span>
        </div>
        {model.secondary != null ? (
          <span
            className={`max-w-[min(100%,220px)] truncate tabular-nums text-zinc-500 sm:max-w-none ${orderBookRowValueCls}`}
          >
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
