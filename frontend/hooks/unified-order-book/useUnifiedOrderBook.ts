"use client";

import { useMemo, useState } from "react";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import {
  buildAskDepthLevels,
  buildBidDepthLevels,
  buildOrderBookCenterModel,
  cmpAskByPriceThenToken,
  cmpBidByPriceDesc,
} from "@/lib/marketplace/unified-order-book";
import type { OrderBookTab } from "@/lib/marketplace/unified-order-book";
import type { CollectionUnifiedOrderBookProps } from "@/lib/marketplace/marketplaceTradingTypes";

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

  const criteriaBids = useMemo(
    () => collectionBids.filter((b) => isCriteriaCollectionBid(b) && b.status === "active"),
    [collectionBids],
  );

  const askRows = useMemo(
    () =>
      [...asks]
        .filter((o) => o.status === "active")
        .sort(cmpAskByPriceThenToken),
    [asks],
  );
  const bidRows = useMemo(() => [...criteriaBids].sort(cmpBidByPriceDesc), [criteriaBids]);

  const askLevels = useMemo(() => buildAskDepthLevels(askRows), [askRows]);
  const bidLevels = useMemo(() => buildBidDepthLevels(bidRows), [bidRows]);

  const bookCenterModel = useMemo(
    () =>
      buildOrderBookCenterModel({
        lastTradePriceUsdc,
        lastTradeSide,
      }),
    [lastTradePriceUsdc, lastTradeSide],
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
