"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getMarketplaceCollectionDetail, rq, marketplaceRqPolicy } from "@/lib/core";
import { invalidateAfterCollectionUpdate } from "@/lib/core/invalidation";
import type { BookRowSelection, TradeCelebrationKind } from "@/lib/marketplace/marketplaceTradingTypes";
import { useCollectionDetailHeadline } from "./useCollectionDetailHeadline";
import { useCollectionDetailListings } from "./useCollectionDetailListings";
import { useCollectionDetailMarketData } from "./useCollectionDetailMarketData";
import { useCollectionDetailMobile } from "./useCollectionDetailMobile";
import { useAppStore, selectWallet } from "@/store";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { buildCollectionDetailOrderBookProps } from "@/lib/marketplace/collectionDetailOrderBook";
import { looksLikeCollectionKey } from "@/lib/ui/page-state-catalog";
import { activeRqChainId } from "@/lib/chains";

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
  const queryClient = useQueryClient();
  const { address } = useAppStore(useShallow(selectWallet));
  const raw = params.collectionKey;
  const rawCollectionKey = Array.isArray(raw) ? raw[0] : raw;
  const collectionKey =
    typeof rawCollectionKey === "string" ? decodeURIComponent(rawCollectionKey) : "";

  const [tradeCelebration, setTradeCelebration] = useState<TradeCelebrationKind | null>(null);
  const [orderBookAskPicker, setOrderBookAskPicker] = useState<BookRowSelection | null>(null);
  useCollectionDetailMobile();
  const [sessionFillPoint, setSessionFillPoint] = useState<{
    t: number;
    v: number;
  } | null>(null);
  const [showOrderBook, setShowOrderBook] = useState(false);

  const chainId = activeRqChainId();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: rq.collectionDetail(collectionKey, chainId),
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

  const invalidateCollection = useCallback(() => {
    void invalidateAfterCollectionUpdate(queryClient, collectionKey);
  }, [queryClient, collectionKey]);

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
      onSelectLevel: () => {},
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
    collectionOrderBookProps,
    tradeCelebration,
    setTradeCelebration,
    orderBookAskPicker,
    setOrderBookAskPicker,
    showOrderBook,
    setShowOrderBook,
  };
}
