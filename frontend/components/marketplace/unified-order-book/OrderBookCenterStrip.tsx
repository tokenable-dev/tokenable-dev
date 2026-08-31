"use client";

import { COLLECTION_DETAILS_BG_CLASS } from "@/components/marketplace/collectionOverviewChrome";
import { orderBookRowValueCls } from "@/components/marketplace/price-metrics-strip/theme";
import {
  formatCollectionDetailBookPriceUsdc,
  type BookCenterModel,
} from "@/lib/marketplace/unified-order-book";

function formatMidUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return formatCollectionDetailBookPriceUsdc(n);
}

export function OrderBookCenterStrip({
  model,
  collectionDetail,
  asksEmptyBidsLive,
  bidsEmptyAsksLive,
  bestBidUsdc,
  bestAskUsdc,
}: {
  model: BookCenterModel;
  collectionDetail?: boolean;
  /** Order book HTML — asks empty, bids live: `$bestBid` | No live spread */
  asksEmptyBidsLive?: boolean;
  /** Order book HTML — bids empty, asks live: `$bestAsk ↓` | No live spread */
  bidsEmptyAsksLive?: boolean;
  bestBidUsdc?: number | null;
  bestAskUsdc?: number | null;
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

  /* Card.html `.ob-spread` — left is best ask (or best bid if no asks) + ↓; right is spread. */
  if (collectionDetail) {
    const oneSided = Boolean(asksEmptyBidsLive || bidsEmptyAsksLive);
    const leftUsd = asksEmptyBidsLive ? bestBidUsdc : bestAskUsdc;
    const hasLiveSpread =
      !oneSided &&
      bestAskUsdc != null &&
      bestBidUsdc != null &&
      Number.isFinite(bestAskUsdc) &&
      Number.isFinite(bestBidUsdc) &&
      bestAskUsdc > bestBidUsdc;
    const spreadLabel = hasLiveSpread
      ? `Spread ${formatCollectionDetailBookPriceUsdc(bestAskUsdc - bestBidUsdc)}`
      : "No live spread";

    return (
      <div className="cd-ob-book-center__strip">
        <span className="cd-ob-book-center__mid-price">
          {formatMidUsd(leftUsd)}
          <span className="cd-ob-book-center__arrow" aria-hidden>
            {" "}
            ↓
          </span>
        </span>
        <span className="cd-ob-book-center__spread">{spreadLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center ${
        isNaPlaceholder ? "gap-0 px-2 py-0" : "gap-0.5 px-2 py-1"
      } ${COLLECTION_DETAILS_BG_CLASS} ${
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
          <span className={`${orderBookRowValueCls} text-zinc-400`}>{model.secondary}</span>
        ) : null}
      </div>
      {hasCaption ? (
        <span className={`${orderBookRowValueCls} text-center text-[11px] text-zinc-500`}>
          {model.caption}
        </span>
      ) : null}
    </div>
  );
}
