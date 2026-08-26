"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Order, RwaMetadata } from "@/lib/core";
import { useRwaDetailBuyFlow } from "@/hooks/rwa-detail/useRwaDetailBuyFlow";
import { useAppChain } from "@/providers/AppChainProvider";
import type { TradeCelebrationKind } from "@/lib/marketplace/marketplaceTradingTypes";

export type ListingModalCheckout = "buy" | "bid" | null;

export function useCollectionListingModal(input: {
  collectionKey: string;
  askMap: Map<number, Order>;
  batchMetadata:
    | Map<number, { metadata: RwaMetadata | null; imageUrl: string | null }>
    | undefined;
  address: string | undefined;
  onInvalidate: () => void;
  onPurchaseCelebration: (kind: TradeCelebrationKind) => void;
}) {
  const { collectionKey, askMap, batchMetadata, address, onInvalidate, onPurchaseCelebration } =
    input;

  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [checkout, setCheckout] = useState<ListingModalCheckout>(null);

  const listingParam = searchParams.get("listing");
  const checkoutParam = searchParams.get("checkout");

  useEffect(() => {
    const n = listingParam ? Number(listingParam) : NaN;
    if (!Number.isFinite(n) || n < 0) return;
    setSelectedTokenId(n);
    if (checkoutParam === "bid") setCheckout("bid");
    else if (checkoutParam === "buy") setCheckout("buy");
    else setCheckout(null);
  }, [listingParam, checkoutParam]);

  const selectedListing = useMemo(
    () => (selectedTokenId != null ? askMap.get(selectedTokenId) ?? null : null),
    [askMap, selectedTokenId],
  );

  const selectedPrefetch = useMemo(
    () => (selectedTokenId != null ? batchMetadata?.get(selectedTokenId) : undefined),
    [batchMetadata, selectedTokenId],
  );

  const closeDetail = useCallback(() => {
    setSelectedTokenId(null);
    setCheckout(null);
  }, []);

  const openListing = useCallback(
    (tokenId: number, action: "view" | "buy" | "bid" = "view") => {
      setSelectedTokenId(tokenId);
      if (action === "buy") setCheckout("buy");
      else if (action === "bid") setCheckout("bid");
      else setCheckout(null);
    },
    [],
  );

  /** Set-level Place a Bid — floor listing if any; otherwise checkout resolves a collection token. */
  const openSetLevelBid = useCallback(() => {
    const asks = [...askMap.values()].filter((o) => o.status === "active");
    asks.sort((a, b) => {
      const pa = Number(a.considerationAmount) || 0;
      const pb = Number(b.considerationAmount) || 0;
      return pa - pb;
    });
    const floor = asks[0];
    if (floor?.tokenId != null) {
      const tid = Number(floor.tokenId);
      if (Number.isFinite(tid)) {
        setSelectedTokenId(tid);
        setCheckout("bid");
        return;
      }
    }
    setSelectedTokenId(null);
    setCheckout("bid");
  }, [askMap]);

  const buyFlow = useRwaDetailBuyFlow({
    tokenId: selectedTokenId ?? 0,
    collectionKeyForMatch: collectionKey,
    activeAskListing: selectedListing,
    address,
    publicClient,
    writeContractAsync,
    queryClient,
    onPurchaseSuccess: () => {
      setCheckout(null);
      setSelectedTokenId(null);
      onPurchaseCelebration("purchase");
      onInvalidate();
    },
  });

  return {
    selectedTokenId,
    selectedListing,
    selectedPrefetch,
    checkout,
    setCheckout,
    openListing,
    openSetLevelBid,
    closeDetail,
    buyFlow,
  };
}
