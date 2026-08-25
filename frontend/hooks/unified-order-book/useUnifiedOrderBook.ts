"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import {
  buildAskDepthLevels,
  buildBidDepthLevels,
  buildOrderBookCenterModel,
  bestAskFromRows,
  bestBidFromRows,
  cmpAskByPriceThenToken,
  cmpBidByPriceDesc,
} from "@/lib/marketplace/unified-order-book";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";

/** Active bids shown in Offers depth — token offers (BR-8a) plus any legacy criteria bids. */
function isActiveOrderBookBid(b: Order): boolean {
  if (b.status !== "active") return false;
  return isTokenBidOrder(b) || isCriteriaCollectionBid(b);
}

export function useUnifiedOrderBook({
  asks,
  collectionBids,
  lastTradePriceUsdc = null,
  lastTradeSide = null,
  compact = false,
  flush = false,
  defaultTab = "book",
}: Pick<
  CollectionUnifiedOrderBookProps,
  | "asks"
  | "collectionBids"
  | "lastTradePriceUsdc"
  | "lastTradeSide"
  | "compact"
  | "flush"
  | "defaultTab"
>) {
  const [tab, setTab] = useState<OrderBookTab>(defaultTab);

  const activeBids = useMemo(
    () => collectionBids.filter(isActiveOrderBookBid),
    [collectionBids],
  );

  const askRows = useMemo(
    () =>
      [...asks]
        .filter((o) => o.status === "active")
        .sort(cmpAskByPriceThenToken),
    [asks],
  );
  const bidRows = useMemo(() => [...activeBids].sort(cmpBidByPriceDesc), [activeBids]);

  const askLevels = useMemo(() => buildAskDepthLevels(askRows), [askRows]);
  const bidLevels = useMemo(() => buildBidDepthLevels(bidRows), [bidRows]);

  const bookCenterModel = useMemo(
    () =>
      buildOrderBookCenterModel({
        lastTradePriceUsdc,
        lastTradeSide,
        bestAskUsdc: bestAskFromRows(askRows),
        bestBidUsdc: bestBidFromRows(bidRows),
      }),
    [lastTradePriceUsdc, lastTradeSide, askRows, bidRows],
  );

  const depthMax = compact ? "max-h-[72px]" : "max-h-[100px]";
  const depthClass = flush
    ? "min-h-[40px] max-h-none overflow-visible"
    : `overflow-y-auto ${depthMax}`;

  return {
    tab,
    setTab,
    askRows,
    bidRows,
    askLevels,
    bidLevels,
    bookCenterModel,
    depthMax,
    depthClass,
  };
}
