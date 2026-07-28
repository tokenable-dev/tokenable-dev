"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getMarketplaceCollectionDetail, rq, marketplaceRqPolicy } from "@/lib/core";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import type { CollectionTradeTab } from "@/lib/marketplace/collection-trading";
import type { TradeCelebrationKind } from "@/lib/marketplace/marketplaceTradingTypes";
import { useCollectionDetailHeadline } from "./useCollectionDetailHeadline";
import { useCollectionDetailInvalidation } from "./useCollectionDetailInvalidation";
import { useCollectionDetailListings } from "./useCollectionDetailListings";
import { useCollectionDetailMarketData } from "./useCollectionDetailMarketData";
import { useCollectionDetailMobile } from "./useCollectionDetailMobile";
import { useAppStore, selectWallet } from "@/store";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { buildCollectionDetailOrderBookProps } from "@/lib/marketplace/collectionDetailOrderBook";
import { looksLikeCollectionKey } from "@/lib/ui/page-state-catalog";

export type CollectionDetailPageStatus =
  | "invalid"
  | "loading"
  | "not_created"
  | "fetch_error"
  | "ready";

export type CollectionDetailPageModel = ReturnType<typeof useCollectionDetailPage>;

export type CollectionDetailLoadedProps = CollectionDetailPageModel & {
  status: "ready";
  data: NonNullable<CollectionDetailPageModel["data"]>;
  collectionOrderBookProps: NonNullable<
    CollectionDetailPageModel["collectionOrderBookProps"]
  >;
};

export function useCollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const rawCollectionKey = Array.isArray(raw) ? raw[0] : raw;
  const collectionKey =
    typeof rawCollectionKey === "string" ? decodeURIComponent(rawCollectionKey) : "";

  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [bookSelection, setBookSelection] = useState<BookRowSelection | null>(null);
  const [orderBookAskPicker, setOrderBookAskPicker] = useState<BookRowSelection | null>(null);
  useCollectionDetailMobile();
  const [aiInsightComingSoonOpen, setAiInsightComingSoonOpen] = useState(false);
  const [sessionFillPoint, setSessionFillPoint] = useState<{
    t: number;
    v: number;
  } | null>(null);
  const [showOrderBook, setShowOrderBook] = useState(false);
  const [tradeFlow, setTradeFlow] = useState<CollectionTradeTab>("buy");
  const [tradeDockOpen, setTradeDockOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: rq.collectionDetail(collectionKey),
    queryFn: () => getMarketplaceCollectionDetail(collectionKey),
    enabled: collectionKey.length > 0 && looksLikeCollectionKey(collectionKey),
    staleTime: marketplaceRqPolicy.collectionDetailStaleMs,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const comp = useMemo(
    () => parseCollectionComponents(data?.collection?.components),
    [data?.collection?.components],
  );

  const hasCollection = Boolean(data?.collection);

  const market = useCollectionDetailMarketData({
    key: collectionKey,
    comp,
    hasCollection,
    collectionComponents: data?.collection?.components,
    detailLoading: isLoading,
    detailError: isError,
    hasDetailData: Boolean(data),
    sessionFillPoint,
    setSessionFillPoint,
  });

  const headline = useCollectionDetailHeadline({
    key: collectionKey,
    comp,
    marketPreview: market.marketPreview,
    pokeTierLabel: market.pokeTierLabel,
    displayLabel: data?.collection?.displayLabel,
    hasCollection,
    activeGradeLabel: market.gradeAwareTierLabel,
  });

  const asks = useMemo(
    () => (data ? data.listings.filter((o) => o.side !== "bid") : []),
    [data],
  );

  const collectionBids = useMemo(() => {
    if (!data?.collectionBids) return [];
    return data.collectionBids.filter((b) => b.status === "active");
  }, [data?.collectionBids]);

  const listings = useCollectionDetailListings({
    collectionKey,
    asks,
    enabled: hasCollection,
  });

  const invalidateCollection = useCollectionDetailInvalidation(collectionKey);

  const presetPriceFromBook = useMemo(() => {
    if (bookSelection == null) return null;
    return bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [bookSelection]);

  const listPricePresetUsdc = useMemo(() => {
    if (bookSelection?.side !== "bid") return null;
    return presetPriceFromBook;
  }, [bookSelection, presetPriceFromBook]);

  const preferredBidOrderHash = useMemo(() => {
    if (bookSelection?.side !== "bid" || !bookSelection.orders.length) return null;
    return bookSelection.orders[0]?.orderHash ?? null;
  }, [bookSelection]);

  const status: CollectionDetailPageStatus = !collectionKey
    ? "invalid"
    : !looksLikeCollectionKey(collectionKey)
      ? "invalid"
      : isLoading
        ? "loading"
        : isError || !data
          ? "fetch_error"
          : !data.collection
            ? "not_created"
            : "ready";

  const collectionOrderBookProps = useMemo(() => {
    if (!data?.collection) return null;
    return buildCollectionDetailOrderBookProps({
      collectionKey: data.collection.collectionKey,
      asks,
      collectionBids,
      selectedLevelKey: orderBookAskPicker?.levelKey ?? null,
      onSelectLevel: (sel) => {
        if (sel.side === "bid") return;
        if (sel.side === "ask") {
          setOrderBookAskPicker(sel);
          return;
        }
        setBookSelection(sel);
        setTradeFlow("buy");
        setTradeDockOpen(true);
      },
      lastTradePriceUsdc: market.orderBookLastSaleUsdc,
      tapeFills: market.orderBookTapeFills,
      tapeLoading: market.platformTradesLoading,
      tapeError: market.platformTradesError,
      tapeErrorMessage:
        market.platformTradesErrorDetail instanceof Error
          ? market.platformTradesErrorDetail.message
          : market.platformTradesError
            ? "Failed to load trades"
            : null,
      connectedAddress: address,
      onInvalidate: invalidateCollection,
    });
  }, [
    data?.collection,
    asks,
    collectionBids,
    orderBookAskPicker?.levelKey,
    market.orderBookLastSaleUsdc,
    market.orderBookTapeFills,
    market.platformTradesLoading,
    market.platformTradesError,
    market.platformTradesErrorDetail,
    address,
    invalidateCollection,
  ]);

  return {
    status,
    error,
    collectionKey,
    router,
    address,
    data: status === "ready" ? data : undefined,
    headline,
    market,
    asks,
    collectionBids,
    listings,
    invalidateCollection,
    presetPriceFromBook,
    listPricePresetUsdc,
    preferredBidOrderHash,
    collectionOrderBookProps,
    sellModalOpen,
    setSellModalOpen,
    tradeCelebration,
    setTradeCelebration,
    bookSelection,
    orderBookAskPicker,
    setOrderBookAskPicker,
    aiInsightComingSoonOpen,
    setAiInsightComingSoonOpen,
    showOrderBook,
    setShowOrderBook,
    tradeFlow,
    setTradeFlow,
    tradeDockOpen,
    setTradeDockOpen,
    setSessionFillPoint,
  };
}
