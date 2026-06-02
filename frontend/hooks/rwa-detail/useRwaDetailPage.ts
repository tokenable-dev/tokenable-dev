"use client";

import { useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useConnect, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import type { RwaDetailMetadata } from "@/lib/marketplace/rwa-detail";
import { useAppStore, selectWallet } from "@/store";
import { useRwaDetailBuyFlow } from "./useRwaDetailBuyFlow";
import { useRwaDetailHeadline } from "./useRwaDetailHeadline";
import { useRwaDetailListFlow } from "./useRwaDetailListFlow";
import { useRwaDetailListing } from "./useRwaDetailListing";
import { useRwaDetailMarketContext } from "./useRwaDetailMarketContext";
import { useRwaDetailMetadata } from "./useRwaDetailMetadata";
import { useRwaDetailOwner } from "./useRwaDetailOwner";
import { useRwaDetailPlatformTrades } from "./useRwaDetailPlatformTrades";

export type RwaDetailPageStatus = "invalid" | "loading" | "not_found" | "ready";

export type RwaDetailPageModel = ReturnType<typeof useRwaDetailPage>;

export type RwaDetailLoadedProps = Extract<RwaDetailPageModel, { status: "ready" }>;

export function useRwaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const tokenId = Number(params.tokenId);
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;
  const fromCollectionParam = searchParams.get("fromCollection")?.trim() ?? "";

  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const { isPending: connectPending } = useConnect();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();

  const {
    metadata,
    imageUrl,
    metaLoading,
    metadataDerivedCollectionKey,
  } = useRwaDetailMetadata(tokenId, tokenIdOk);

  const {
    listing,
    listingError,
    activeAskListing,
    listingBuyPriceUsdc,
    isListingSeller,
  } = useRwaDetailListing(tokenId, tokenIdOk, address);

  const { ownerLoading, ownerError, ownerOnChain, isOwner } = useRwaDetailOwner(
    tokenId,
    tokenIdOk,
    address,
  );

  const market = useRwaDetailMarketContext({
    tokenIdOk,
    fromCollectionParam,
    listingCollectionKey: listing?.collectionKey,
    metadataDerivedCollectionKey,
  });

  const platformTrades = useRwaDetailPlatformTrades({
    tokenId,
    tokenIdOk,
    collectionKey: market.collectionKeyForMatch,
  });

  const headline = useRwaDetailHeadline(
    tokenId,
    metadata as RwaDetailMetadata | null,
    metaLoading,
  );

  const navigateToCollectionAfterTrade = useCallback(() => {
    if (market.collectionKeyForRedirect) {
      router.replace(
        `/marketplace/collections/${encodeURIComponent(market.collectionKeyForRedirect)}`,
        { scroll: true },
      );
    } else {
      router.replace("/?tab=marketplace", { scroll: true });
    }
  }, [router, market.collectionKeyForRedirect]);

  const listFlow = useRwaDetailListFlow({
    tokenId,
    tokenIdOk,
    searchParams,
    router,
    isOwner,
    isConnected,
    ownerLoading,
  });

  const buyFlow = useRwaDetailBuyFlow({
    tokenId,
    collectionKeyForMatch: market.collectionKeyForMatch,
    activeAskListing,
    address,
    publicClient: publicClient ?? undefined,
    writeContractAsync,
    queryClient,
    onPurchaseSuccess: () => {
      listFlow.setTradeCelebration("purchase");
      navigateToCollectionAfterTrade();
    },
  });

  const showMain = tokenIdOk && !ownerLoading && !ownerError && ownerOnChain != null;

  const showMobileMarketContext =
    !activeAskListing &&
    !isOwner &&
    (market.externalRefUsd != null || market.marketChangePct != null);

  const status: RwaDetailPageStatus = !tokenIdOk
    ? "invalid"
    : ownerLoading
      ? "loading"
      : ownerError
        ? "not_found"
        : showMain
          ? "ready"
          : "loading";

  const base = {
    router,
    tokenId,
    metadata: metadata as RwaDetailMetadata | null,
    imageUrl,
    metaLoading,
    listing,
    listingError,
    activeAskListing,
    listingBuyPriceUsdc,
    isListingSeller,
    isOwner,
    isConnected,
    connectPending,
    address,
    market,
    platformTrades,
    headline,
    listFlow,
    buyFlow,
    showMobileMarketContext,
    navigateToCollectionAfterTrade,
  };

  if (status === "ready") {
    return { status, ...base };
  }

  return { status, ...base };
}
