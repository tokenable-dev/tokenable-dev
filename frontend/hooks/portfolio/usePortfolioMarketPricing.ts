"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRwaTokenTrades,
  postBatchMintMarketPreviews,
  postPortfolioCollectionMarketBatchBatched,
  rq,
  type CollectionMarketPreview,
  type CollectionMarketSeries,
  type CollectionMarketStats,
  type PortfolioMarketBatchItem,
} from "@/lib/core";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { extractSparklineFromTapeFills } from "@/lib/portfolio/portfolioTableHelpers";
import { activeRqChainId } from "@/lib/chains";

const EMPTY_MINT_PREVIEW: Record<number, CollectionMarketPreview | undefined> = {};
const EMPTY_SPARKLINE: Record<number, number[]> = {};
const TOKEN_SPARKLINE_CONCURRENCY = 8;

function batchNeedsSnapshotPoll(items: PortfolioMarketBatchItem[] | undefined): boolean {
  if (!items || items.length === 0) return false;
  return items.some(
    (it) =>
      it.series?.cardhedgerPreview?.matched !== true && !it.series?.syncedAt,
  );
}

function snapshotPreviewMatched(item: PortfolioMarketBatchItem | undefined): boolean {
  return Boolean(
    item?.series?.cardhedgerPreview?.matched && item.series.cardhedgerPreview.card,
  );
}

async function fetchTokenSparklines(
  tokenIds: number[],
): Promise<Record<number, number[]>> {
  const out: Record<number, number[]> = {};
  for (let i = 0; i < tokenIds.length; i += TOKEN_SPARKLINE_CONCURRENCY) {
    const chunk = tokenIds.slice(i, i + TOKEN_SPARKLINE_CONCURRENCY);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        try {
          const tape = await getRwaTokenTrades(id);
          return [id, extractSparklineFromTapeFills(tape.trades)] as const;
        } catch {
          return [id, [] as number[]] as const;
        }
      }),
    );
    for (const [id, spark] of rows) out[id] = spark;
  }
  return out;
}

export function usePortfolioMarketPricing(input: {
  address: string | undefined;
  isConnected: boolean;
  assets: OwnedAsset[];
  uniqueCollectionKeys: string[];
  tokenToCollectionKey: Record<number, string>;
}) {
  const {
    address,
    isConnected,
    assets,
    uniqueCollectionKeys,
    tokenToCollectionKey,
  } = input;

  const chainId = activeRqChainId();
  const hasCollectionBuckets = uniqueCollectionKeys.length > 0;

  const {
    data: portfolioMarketBatch,
    isLoading: portfolioMarketBatchLoading,
    isFetched: portfolioMarketBatchFetched,
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

  const snapshotReady =
    uniqueCollectionKeys.length === 0 ||
    portfolioMarketBatchFetched ||
    !portfolioMarketBatchLoading;

  const unmatchedTokenIds = useMemo(() => {
    if (!address || !isConnected || assets.length === 0) return [];
    if (!snapshotReady) return [];
    const byKey = new Map<string, PortfolioMarketBatchItem>();
    for (const it of portfolioMarketBatch?.items ?? []) {
      byKey.set(it.collectionKey.toLowerCase(), it);
    }
    return assets
      .filter((a) => {
        const ck = tokenToCollectionKey[a.tokenId]?.toLowerCase();
        if (!ck) return true;
        return !snapshotPreviewMatched(byKey.get(ck));
      })
      .map((a) => a.tokenId);
  }, [
    address,
    isConnected,
    assets,
    snapshotReady,
    portfolioMarketBatch,
    tokenToCollectionKey,
  ]);

  const { data: mintPreviewByToken = EMPTY_MINT_PREVIEW, isLoading: mintPreviewLoading } =
    useQuery({
      queryKey: rq.marketMintPreviews(address, unmatchedTokenIds, chainId),
      queryFn: () => postBatchMintMarketPreviews(unmatchedTokenIds),
      enabled:
        Boolean(address && isConnected) &&
        unmatchedTokenIds.length > 0,
    });

  const { data: sparklineByToken = EMPTY_SPARKLINE, isLoading: sparklineLoading } =
    useQuery({
      queryKey: rq.portfolioTokenSparklines(chainId, unmatchedTokenIds),
      queryFn: () => fetchTokenSparklines(unmatchedTokenIds),
      enabled:
        Boolean(address && isConnected) &&
        unmatchedTokenIds.length > 0,
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

  const statsLoadingAny =
    portfolioMarketBatchLoading && hasCollectionBuckets;
  const overlayPending =
    unmatchedTokenIds.length > 0 && (mintPreviewLoading || sparklineLoading);

  const valuesPending =
    Boolean(address) &&
    isConnected &&
    assets.length > 0 &&
    (statsLoadingAny || overlayPending || !snapshotReady);

  return {
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    sparklineByToken,
    portfolioMarketBatchLoading,
    hasCollectionBuckets,
    valuesPending,
  };
}
