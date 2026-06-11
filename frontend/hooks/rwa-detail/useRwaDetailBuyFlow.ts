"use client";

import { useCallback, useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Address, PublicClient } from "viem";
import { sepolia } from "@/config/wagmi";
import type { Order } from "@/lib/core";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import { mapWalletError } from "@/lib/network";
import { invalidateAfterRwaDetail } from "@/lib/core/invalidation";
import type { useWriteContract } from "wagmi";

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
        chainId: sepolia.id,
      });
      await invalidateMarketplaceQueries();
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
