"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postPortfolioAssetsPage,
  rq,
  type CollectionMarketSeries,
  type CollectionMarketPreview,
  type CollectionMarketStats,
  type PortfolioMarketBatchItem,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  primeRwaMetadataCache,
} from "@/lib/marketplace";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import type { RwaMetadata } from "@/lib/core";

const EMPTY_MINT: Record<number, CollectionMarketPreview | undefined> = {};

/**
 * My Assets BFF — one HTTP round-trip per incremental tokenId page.
 * Replaces separate metadata, collection-key, market-batch, and mint-preview calls.
 */
export function usePortfolioAssetsPage(input: {
  address: string | undefined;
  enabled: boolean;
  /** Loaded page tokenIds (newest first from useUserAssets). */
  tokenIds: number[];
  listingCollectionKeyByToken: Map<number, string>;
}) {
  const { address, enabled, tokenIds, listingCollectionKeyByToken } = input;
  const chainId = activeRqChainId();

  const fetchedTokenIdsRef = useRef<Set<number>>(new Set());
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const [accumulated, setAccumulated] = useState<{
    metadataByToken: Map<number, OwnedAsset>;
    collectionKeys: Record<number, string>;
    marketItems: PortfolioMarketBatchItem[];
    mintPreviews: Record<number, CollectionMarketPreview>;
  }>({
    metadataByToken: new Map(),
    collectionKeys: {},
    marketItems: [],
    mintPreviews: {},
  });

  useEffect(() => {
    fetchedTokenIdsRef.current = new Set();
    setAccumulated({
      metadataByToken: new Map(),
      collectionKeys: {},
      marketItems: [],
      mintPreviews: {},
    });
    setFetchGeneration((g) => g + 1);
  }, [address, chainId]);

  const pendingTokenIds = useMemo(() => {
    void fetchGeneration;
    return tokenIds.filter((id) => !fetchedTokenIdsRef.current.has(id));
  }, [tokenIds, fetchGeneration]);

  const {
    data: pageData,
    isFetching,
    isFetched: pendingBatchFetched,
  } = useQuery({
    queryKey: rq.portfolioAssetsPage(address ?? "", pendingTokenIds, chainId),
    queryFn: () =>
      postPortfolioAssetsPage({
        walletAddress: address!,
        tokenIds: pendingTokenIds,
      }),
    enabled: Boolean(address && enabled && pendingTokenIds.length > 0),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!pendingBatchFetched || pendingTokenIds.length === 0) return;
    const ids = [...pendingTokenIds];
    for (const id of ids) {
      fetchedTokenIdsRef.current.add(id);
    }

    if (pageData) {
      primeRwaMetadataCache(
        pageData.metadataItems.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );

      setAccumulated((prev) => {
        const metadataByToken = new Map(prev.metadataByToken);
        for (const it of pageData.metadataItems) {
          metadataByToken.set(it.tokenId, {
            tokenId: it.tokenId,
            metadata: it.metadata as RwaMetadata | null,
            imageUrl: it.imageUrl,
          });
        }

        const collectionKeys = { ...prev.collectionKeys, ...pageData.collectionKeys };
        const marketByKey = new Map(
          prev.marketItems.map((m) => [m.collectionKey.toLowerCase(), m]),
        );
        for (const it of pageData.marketItems) {
          marketByKey.set(it.collectionKey.toLowerCase(), it);
        }

        return {
          metadataByToken,
          collectionKeys,
          marketItems: [...marketByKey.values()],
          mintPreviews: { ...prev.mintPreviews, ...pageData.mintPreviews },
        };
      });
    }

    setFetchGeneration((g) => g + 1);
  }, [pendingBatchFetched, pageData, pendingTokenIds]);

  const assets = useMemo(() => {
    return tokenIds
      .filter((id) => accumulated.metadataByToken.has(id))
      .map((id) => accumulated.metadataByToken.get(id)!);
  }, [tokenIds, accumulated.metadataByToken]);

  const tokenToServerCollectionKey = useMemo(() => {
    const o: Record<number, string> = { ...accumulated.collectionKeys };
    for (const a of assets) {
      const listingKey = listingCollectionKeyByToken
        .get(a.tokenId)
        ?.trim()
        .toLowerCase();
      if (listingKey) o[a.tokenId] = listingKey;
    }
    return o;
  }, [assets, accumulated.collectionKeys, listingCollectionKeyByToken]);

  const tokenToCollectionKey = useMemo(() => {
    return { ...tokenToServerCollectionKey };
  }, [tokenToServerCollectionKey]);

  const uniqueCollectionKeys = useMemo(
    () => [...new Set(Object.values(tokenToServerCollectionKey))],
    [tokenToServerCollectionKey],
  );

  const statsByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketStats>();
    for (const it of accumulated.marketItems) {
      if (it.stats) m.set(it.collectionKey.toLowerCase(), it.stats);
    }
    return m;
  }, [accumulated.marketItems]);

  const seriesByCollectionKey = useMemo(() => {
    const m = new Map<string, CollectionMarketSeries>();
    for (const it of accumulated.marketItems) {
      if (it.series) {
        m.set(it.collectionKey.toLowerCase(), it.series);
      }
    }
    return m;
  }, [accumulated.marketItems]);

  const mintPreviewByToken = useMemo(() => {
    return accumulated.mintPreviews as Record<
      number,
      CollectionMarketPreview | undefined
    >;
  }, [accumulated.mintPreviews]);

  const serverKeysReady =
    tokenIds.length === 0 || (pendingTokenIds.length === 0 && !isFetching);

  const valuesPending =
    Boolean(address) && enabled && tokenIds.length > 0 && !serverKeysReady;

  const isLoading =
    enabled &&
    tokenIds.length > 0 &&
    assets.length === 0 &&
    (isFetching || pendingTokenIds.length > 0);

  return {
    assets,
    tokenToCollectionKey,
    tokenToServerCollectionKey,
    uniqueCollectionKeys,
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken: mintPreviewByToken ?? EMPTY_MINT,
    serverKeysReady,
    valuesPending,
    isLoading,
    isFetching,
  };
}
