"use client";

import {
  COLLECTION_DETAILS_BORDER_B,
  COLLECTION_DETAILS_BORDER_T,
} from "@/components/marketplace/collectionOverviewChrome";
import type { BookCenterModel, OrderBookDepthLevel } from "@/lib/marketplace/unified-order-book";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import { OrderBookCenterStrip } from "./OrderBookCenterStrip";
import { OrderBookDepthLevelRow } from "./OrderBookDepthLevelRow";

function OrderBookColumnHeader() {
  return (
    <div
      className={`relative grid shrink-0 grid-cols-[1fr_44px] gap-1.5 px-2.5 py-1.5 text-[9px] font-medium text-gray-500 sm:px-3 ${COLLECTION_DETAILS_BORDER_B}`}
    >
      <span>Price (USDC)</span>
      <span className="text-right tabular-nums">Count</span>
    </div>
  );
}

function OrderBookFooterCounts({
  bidCount,
  askCount,
  flush,
  showSellHint,
}: {
  bidCount: number;
  askCount: number;
  flush?: boolean;
  showSellHint?: boolean;
}) {
  return (
    <div
      className={
        flush
          ? `shrink-0 space-y-1 px-2.5 py-1.5 ${COLLECTION_DETAILS_BORDER_T}`
          : `${COLLECTION_DETAILS_BORDER_T} px-2.5 py-1.5 space-y-1`
      }
    >
      <div className="flex justify-between gap-2 font-mono text-[9px] tabular-nums text-gray-600">
        <span>
          Bids <span className="text-zinc-400/90">{bidCount}</span>
        </span>
        <span>
          Asks <span className="text-rose-400/80">{askCount}</span>
        </span>
      </div>
      {showSellHint ? (
        <p className="text-[9px] leading-snug text-gray-600">
          Selling: use the <span className="text-gray-400">Sell</span> tab or list from your asset;
          crossing bids fill automatically when you list at or below a collection bid.
        </p>
      ) : null}
    </div>
  );
}

function AskLevelsList({
  levels,
  emptyLabel,
  selectedLevelKey,
  onSelectLevel,
  flush,
  wrapperClass,
}: {
  levels: OrderBookDepthLevel[];
  emptyLabel: string;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
  wrapperClass: string;
}) {
  return (
    <div className={wrapperClass}>
      {levels.length === 0 ? (
        <div className="py-3 text-center text-[10px] text-gray-600">{emptyLabel}</div>
      ) : (
        levels.map((level) => (
          <OrderBookDepthLevelRow
            key={level.key}
            side="ask"
            level={level}
            selectedLevelKey={selectedLevelKey}
            onSelectLevel={onSelectLevel}
            flush={flush}
          />
        ))
      )}
    </div>
  );
}

function BidLevelsList({
  levels,
  emptyLabel,
  selectedLevelKey,
  onSelectLevel,
  flush,
  wrapperClass,
}: {
  levels: OrderBookDepthLevel[];
  emptyLabel: string;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
  flush?: boolean;
  wrapperClass: string;
}) {
  return (
    <div className={wrapperClass}>
      {levels.length === 0 ? (
        <div className="py-3 text-center text-[10px] text-gray-600">{emptyLabel}</div>
      ) : (
        levels.map((level) => (
          <OrderBookDepthLevelRow
            key={level.key}
            side="bid"
            level={level}
            selectedLevelKey={selectedLevelKey}
            onSelectLevel={onSelectLevel}
            flush={flush}
          />
        ))
      )}
    </div>
  );
}

export function OrderBookBookTab({
  flush,
  compact,
  depthMax,
  askLevels,
  bidLevels,
  bookCenterModel,
  bidCount,
  askCount,
  selectedLevelKey,
  onSelectLevel,
}: {
  flush?: boolean;
  compact?: boolean;
  depthMax: string;
  askLevels: OrderBookDepthLevel[];
  bidLevels: OrderBookDepthLevel[];
  bookCenterModel: BookCenterModel;
  bidCount: number;
  askCount: number;
  selectedLevelKey?: string | null;
  onSelectLevel?: (selection: BookRowSelection) => void;
}) {
  if (flush) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <OrderBookColumnHeader />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto">
          <AskLevelsList
            levels={askLevels}
            emptyLabel="No sell orders"
            selectedLevelKey={selectedLevelKey}
            onSelectLevel={onSelectLevel}
            flush
            wrapperClass="flex min-h-full flex-col justify-end gap-px px-1 pt-0.5 pb-0.5"
          />
        </div>
        <div className="relative mx-0.5 shrink-0">
          <OrderBookCenterStrip model={bookCenterModel} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-auto">
          <BidLevelsList
            levels={bidLevels}
            emptyLabel="No buy orders"
            selectedLevelKey={selectedLevelKey}
            onSelectLevel={onSelectLevel}
            flush
            wrapperClass="flex flex-col gap-px px-1 py-0.5 pb-1.5"
          />
        </div>
        <OrderBookFooterCounts bidCount={bidCount} askCount={askCount} flush />
      </div>
    );
  }

  return (
    <>
      <OrderBookColumnHeader />
      <AskLevelsList
        levels={askLevels}
        emptyLabel="No sell orders"
        selectedLevelKey={selectedLevelKey}
        onSelectLevel={onSelectLevel}
        wrapperClass={`min-h-[36px] flex flex-col justify-end gap-px px-1 pt-0.5 overflow-y-auto ${depthMax}`}
      />
      <div className="relative mx-0.5 my-0.5">
        <OrderBookCenterStrip model={bookCenterModel} />
      </div>
      <BidLevelsList
        levels={bidLevels}
        emptyLabel="No buy orders"
        selectedLevelKey={selectedLevelKey}
        onSelectLevel={onSelectLevel}
        wrapperClass={`${depthMax} overflow-y-auto flex flex-col gap-px px-1 pb-1.5`}
      />
      <OrderBookFooterCounts
        bidCount={bidCount}
        askCount={askCount}
        showSellHint={bidCount > 0 && !compact}
      />
    </>
  );
}
