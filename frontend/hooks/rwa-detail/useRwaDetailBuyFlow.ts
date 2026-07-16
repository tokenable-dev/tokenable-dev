"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Address, PublicClient } from "viem";
import { useAppChain } from "@/providers/AppChainProvider";
import type { Order } from "@/lib/core";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import { mapWalletError } from "@/lib/network";
import { invalidateAfterRwaDetail } from "@/lib/core/invalidation";
import type { useWriteContract } from "wagmi";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

export function useRwaDetailBuyFlow(input: {
  tokenId: number;
  collectionKeyForMatch: string | null;
  activeAskListing: Order | null;
  address: string | undefined;
  publicClient: PublicClient | undefined;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  queryClient: QueryClient;
  onPurchaseSuccess: () => void;
}) {
  const {
    tokenId,
    collectionKeyForMatch,
    activeAskListing,
    address,
    publicClient,
    writeContractAsync,
    queryClient,
    onPurchaseSuccess,
  } = input;

  const { chainId } = useAppChain();

  const [buyBusy, setBuyBusy] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);

  const invalidateMarketplaceQueries = useCallback(async () => {
    await invalidateAfterRwaDetail(queryClient, {
      tokenId,
      collectionKeyForMatch,
    });
  }, [queryClient, tokenId, collectionKeyForMatch]);

  const handleFulfillAsk = useCallback(async () => {
    if (!activeAskListing || !address || !publicClient) return;
    setBuyErr(null);
    setBuyBusy(true);
    try {
      await fulfillAskListingOrder({
        ask: activeAskListing,
        address: address as Address,
        publicClient,
        writeContractAsync: writeContractAsync as Parameters<
          typeof fulfillAskListingOrder
        >[0]["writeContractAsync"],
        chainId,
      });
      await invalidateMarketplaceQueries();
      const priceUsdc = Number(activeAskListing.considerationAmount) / 1_000_000;
      const fee = Math.round(priceUsdc * 0.05 * 100) / 100;
      trackEvent("purchase_completed", {
        card_id: String(tokenId),
        price: priceUsdc,
        fee,
        net_amount: Math.round(priceUsdc * 0.95 * 100) / 100,
      });
      onPurchaseSuccess();
    } catch (e: unknown) {
      setBuyErr(mapWalletError(e).message);
    } finally {
      setBuyBusy(false);
    }
  }, [
    activeAskListing,
    address,
    publicClient,
    writeContractAsync,
    chainId,
    invalidateMarketplaceQueries,
    onPurchaseSuccess,
  ]);

  useEffect(() => {
    setBuyErr(null);
  }, [activeAskListing?.orderHash, address]);

  return {
    buyBusy,
    buyErr,
    handleFulfillAsk,
    invalidateMarketplaceQueries,
  };
}
