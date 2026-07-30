"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  marketplaceRqPolicy,
  postBatchMintMarketPreviews,
  postPortfolioCollectionMarketBatchBatched,
  rq,
  type CollectionMarketSeries,
  type CollectionMarketStats,
} from "@/lib/core";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { activeRqChainId } from "@/lib/chains";

export function usePortfolioMarketPricing(input: {
  address: string | undefined;
  isConnected: boolean;
  assets: OwnedAsset[];
  uniqueCollectionKeys: string[];
  tokenToCollectionKey: Record<number, string>;
}) {
  const { address, isConnected, assets, uniqueCollectionKeys, tokenToCollectionKey } =
    input;

  const chainId = activeRqChainId();
  const hasCollectionBuckets = uniqueCollectionKeys.length > 0;

  const {
    data: portfolioMarketBatch,
    isLoading: portfolioMarketBatchLoading,
  } = useQuery({
    queryKey: rq.portfolioMarketBatch(chainId, uniqueCollectionKeys),
    queryFn: () =>
      postPortfolioCollectionMarketBatchBatched({
        collectionKeys: uniqueCollectionKeys,
        priceHistoryDuration: "max",
      }),
    enabled:
      uniqueCollectionKeys.length > 0 && Boolean(address && isConnected),
    staleTime: 120_000,
  });

  const statsByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketStats>();
    for (const it of portfolioMarketBatch?.items ?? []) {
      const k = it.collectionKey.toLowerCase();
      if (it.stats) m.set(k, it.stats);
    }
    return m;
  }, [portfolioMarketBatch]);

  const seriesByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketSeries>();
    for (const it of portfolioMarketBatch?.items ?? []) {
      const k = it.collectionKey.toLowerCase();
      if (it.series) m.set(k, it.series);
    }
    return m;
  }, [portfolioMarketBatch]);

  const tokenIdsNeedingMintPreview = useMemo(() => {
    if (portfolioMarketBatchLoading) return [];
    return assets
      .filter((a) => {
        const ck = tokenToCollectionKey[a.tokenId]?.toLowerCase();
        if (!ck) return true;
        const preview = seriesByCollectionKey.get(ck)?.cardhedgerPreview;
        return !(preview?.matched && preview?.card);
      })
      .map((a) => a.tokenId);
  }, [
    assets,
    tokenToCollectionKey,
    seriesByCollectionKey,
    portfolioMarketBatchLoading,
  ]);

  const { data: mintPreviewByToken = {}, isLoading: mintFallbackLoading } = useQuery({
    queryKey: rq.marketMintPreviews(address, tokenIdsNeedingMintPreview, chainId),
    queryFn: () => postBatchMintMarketPreviews(tokenIdsNeedingMintPreview),
    enabled:
      Boolean(address && isConnected) &&
      tokenIdsNeedingMintPreview.length > 0 &&
      !portfolioMarketBatchLoading,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
  });

  const statsLoadingAny =
    portfolioMarketBatchLoading && hasCollectionBuckets;
  const seriesLoadingAny =
    portfolioMarketBatchLoading && hasCollectionBuckets;

  const valuesPending =
    Boolean(address) &&
    isConnected &&
    assets.length > 0 &&
    (mintFallbackLoading ||
      (hasCollectionBuckets && statsLoadingAny) ||
      (hasCollectionBuckets && seriesLoadingAny));

  return {
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    portfolioMarketBatchLoading,
    hasCollectionBuckets,
    valuesPending,
  };
}
