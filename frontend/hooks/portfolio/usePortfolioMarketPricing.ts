"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postBatchMintMarketPreviews,
  postPortfolioCollectionMarketBatchBatched,
  rq,
  type CollectionMarketPreview,
  type CollectionMarketSeries,
  type CollectionMarketStats,
  type PortfolioMarketBatchItem,
} from "@/lib/core";
import { portfolioSnapshotCanPriceHoldings } from "@/lib/portfolio/portfolioAssetMeta";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { activeRqChainId } from "@/lib/chains";

const EMPTY_MINT_PREVIEW: Record<number, CollectionMarketPreview | undefined> = {};

function batchNeedsSnapshotPoll(items: PortfolioMarketBatchItem[] | undefined): boolean {
  if (!items || items.length === 0) return false;
  return items.some(
    (it) =>
      it.series?.cardhedgerPreview?.matched !== true && !it.series?.syncedAt,
  );
}

export function usePortfolioMarketPricing(input: {
  address: string | undefined;
  isConnected: boolean;
  assets: OwnedAsset[];
  uniqueCollectionKeys: string[];
  tokenToServerCollectionKey: Record<number, string>;
  serverKeysReady: boolean;
}) {
  const {
    address,
    isConnected,
    assets,
    uniqueCollectionKeys,
    tokenToServerCollectionKey,
    serverKeysReady,
  } = input;

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
        priceHistoryDuration: "365d",
      }),
    enabled:
      uniqueCollectionKeys.length > 0 && Boolean(address && isConnected),
    staleTime: 120_000,
    refetchInterval: (q) =>
      batchNeedsSnapshotPoll(q.state.data?.items) ? 20_000 : false,
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

  const snapshotBatchSettled =
    !hasCollectionBuckets ||
    !portfolioMarketBatchLoading;

  const unmatchedTokenIds = useMemo(() => {
    if (!address || !isConnected || assets.length === 0) return [];
    if (!serverKeysReady) return [];
    if (!snapshotBatchSettled) return [];
    return assets
      .filter((a) => {
        const ck = tokenToServerCollectionKey[a.tokenId]?.toLowerCase();
        if (!ck) return true;
        return !portfolioSnapshotCanPriceHoldings(
          seriesByCollectionKey.get(ck),
        );
      })
      .map((a) => a.tokenId);
  }, [
    address,
    isConnected,
    assets,
    serverKeysReady,
    snapshotBatchSettled,
    tokenToServerCollectionKey,
    seriesByCollectionKey,
  ]);

  const { data: mintPreviewByToken = EMPTY_MINT_PREVIEW } = useQuery({
    queryKey: rq.marketMintPreviews(address, unmatchedTokenIds, chainId),
    queryFn: () => postBatchMintMarketPreviews(unmatchedTokenIds),
    enabled:
      Boolean(address && isConnected) && unmatchedTokenIds.length > 0,
  });

  const valuesPending =
    Boolean(address) &&
    isConnected &&
    assets.length > 0 &&
    (!serverKeysReady ||
      (hasCollectionBuckets && portfolioMarketBatchLoading));

  return {
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    portfolioMarketBatchLoading,
    hasCollectionBuckets,
    valuesPending,
  };
}
