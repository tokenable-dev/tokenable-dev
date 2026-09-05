"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postBatchMintMarketPreviews,
  postPortfolioAssetsPage,
  rq,
  type CollectionMarketSeries,
  type CollectionMarketPreview,
  type CollectionMarketStats,
  type PortfolioHoldingBatchItem,
  type PortfolioMarketBatchItem,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  primeRwaMetadataCache,
} from "@/lib/marketplace";
import {
  accumulatedFromPortfolioBundle,
  persistPortfolioAccumulated,
  readPortfolioBundle,
  readPortfolioBffLoadedCount,
} from "@/lib/portfolio/portfolioQueryPersistence";
import { portfolioSnapshotCanPriceHoldings } from "@/lib/portfolio/portfolioAssetMeta";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import type { RwaMetadata } from "@/lib/core";

const EMPTY_MINT: Record<number, CollectionMarketPreview | undefined> = {};

/** Default My Assets page size — matches backend `PORTFOLIO_ASSETS_PAGE_MAX`. */
export const PORTFOLIO_ASSETS_PAGE_SIZE = 50;

function emptyAccumulated() {
  return {
    metadataByToken: new Map<number, OwnedAsset>(),
    collectionKeys: {} as Record<number, string>,
    marketItems: [] as PortfolioMarketBatchItem[],
    holdingsByToken: new Map<number, PortfolioHoldingBatchItem>(),
    mintPreviews: {} as Record<number, CollectionMarketPreview>,
  };
}

function mergePageIntoAccumulated(
  prev: ReturnType<typeof emptyAccumulated>,
  pageData: Awaited<ReturnType<typeof postPortfolioAssetsPage>>,
) {
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

  const holdingsByToken = new Map(prev.holdingsByToken);
  for (const h of pageData.holdings) {
    holdingsByToken.set(h.tokenId, h);
  }

  return {
    metadataByToken,
    collectionKeys,
    marketItems: [...marketByKey.values()],
    holdingsByToken,
    mintPreviews: prev.mintPreviews,
  };
}

/**
 * My Assets BFF — DB-backed wallet bootstrap + incremental tokenId pages.
 */
export function usePortfolioAssetsPage(input: {
  address: string | undefined;
  enabled: boolean;
  listingCollectionKeyByToken: Map<number, string>;
}) {
  const { address, enabled, listingCollectionKeyByToken } = input;
  const chainId = activeRqChainId();

  const fetchedTokenIdsRef = useRef<Set<number>>(new Set());
  const bootstrapDoneRef = useRef(false);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const [ownedTokenIds, setOwnedTokenIds] = useState<number[]>([]);
  const [accumulated, setAccumulated] = useState(emptyAccumulated);
  const [bffLoadedCount, setBffLoadedCount] = useState(PORTFOLIO_ASSETS_PAGE_SIZE);

  const resetForWallet = () => {
    fetchedTokenIdsRef.current = new Set();
    bootstrapDoneRef.current = false;
    setOwnedTokenIds([]);
    setAccumulated(emptyAccumulated());
    setBffLoadedCount(PORTFOLIO_ASSETS_PAGE_SIZE);
    setFetchGeneration((g) => g + 1);
  };

  useLayoutEffect(() => {
    if (!address?.trim()) {
      resetForWallet();
      return;
    }
    const bundle = readPortfolioBundle(address, chainId);
    if (!bundle) {
      resetForWallet();
      return;
    }
    // Instant paint from cache — server bootstrap still runs to pick up new mints.
    const restored = accumulatedFromPortfolioBundle(bundle);
    fetchedTokenIdsRef.current = new Set(restored.fetchedTokenIds);
    bootstrapDoneRef.current = bundle.tokenIds.length > 0;
    setOwnedTokenIds(bundle.tokenIds);
    setBffLoadedCount(
      readPortfolioBffLoadedCount(address, chainId, PORTFOLIO_ASSETS_PAGE_SIZE),
    );
    setAccumulated({
      metadataByToken: new Map(
        [...restored.metadataByToken.entries()].map(([id, a]) => [
          id,
          {
            tokenId: a.tokenId,
            metadata: a.metadata,
            imageUrl: a.imageUrl,
          },
        ]),
      ),
      collectionKeys: restored.collectionKeys,
      marketItems: restored.marketItems,
      holdingsByToken: restored.holdingsByToken,
      mintPreviews: restored.mintPreviews,
    });
    setFetchGeneration((g) => g + 1);
  }, [address, chainId]);

  const {
    data: bootstrapData,
    isFetching: bootstrapFetching,
    isFetched: bootstrapFetched,
  } = useQuery({
    queryKey: rq.portfolioAssetsPageBootstrap(address ?? "", chainId),
    queryFn: () => postPortfolioAssetsPage({ walletAddress: address! }),
    // Always sync ownedTokenIds from DB — localStorage / RQ hydrate must not freeze the list after mint.
    enabled: Boolean(address && enabled),
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!bootstrapFetched || !bootstrapData) return;
    bootstrapDoneRef.current = true;
    const serverIds = bootstrapData.ownedTokenIds ?? [];
    setOwnedTokenIds(serverIds);

    primeRwaMetadataCache(
      bootstrapData.metadataItems.map((it) => ({
        tokenId: it.tokenId,
        metadata: it.metadata,
        imageUrl: it.imageUrl,
      })),
    );

    for (const id of bootstrapData.metadataItems.map((it) => it.tokenId)) {
      fetchedTokenIdsRef.current.add(id);
    }

    setAccumulated((prev) => mergePageIntoAccumulated(prev, bootstrapData));
    setFetchGeneration((g) => g + 1);
  }, [bootstrapFetched, bootstrapData]);

  const loadedTokenIds = useMemo(() => {
    return ownedTokenIds.slice(0, Math.max(0, bffLoadedCount));
  }, [ownedTokenIds, bffLoadedCount]);

  const pendingTokenIds = useMemo(() => {
    void fetchGeneration;
    return loadedTokenIds.filter((id) => !fetchedTokenIdsRef.current.has(id));
  }, [loadedTokenIds, fetchGeneration]);

  const {
    data: pageData,
    isFetching: pageFetching,
    isFetched: pendingBatchFetched,
  } = useQuery({
    queryKey: rq.portfolioAssetsPage(address ?? "", pendingTokenIds, chainId),
    queryFn: () =>
      postPortfolioAssetsPage({
        walletAddress: address!,
        tokenIds: pendingTokenIds,
      }),
    enabled:
      Boolean(address && enabled) &&
      pendingTokenIds.length > 0 &&
      bootstrapDoneRef.current,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!pendingBatchFetched || pendingTokenIds.length === 0) return;
    const ids = [...pendingTokenIds];
    for (const id of ids) {
      fetchedTokenIdsRef.current.add(id);
    }

    if (pageData) {
      // Do not clobber ownedTokenIds from incremental page cache — bootstrap owns the list.

      primeRwaMetadataCache(
        pageData.metadataItems.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );

      setAccumulated((prev) => mergePageIntoAccumulated(prev, pageData));
    }

    setFetchGeneration((g) => g + 1);
  }, [pendingBatchFetched, pageData, pendingTokenIds]);

  const assets = useMemo(() => {
    // Show shells as soon as we know owned ids — don't wait for BFF metadata.
    return loadedTokenIds.map((id) => {
      const loaded = accumulated.metadataByToken.get(id);
      if (loaded) return loaded;
      return {
        tokenId: id,
        metadata: null,
        imageUrl: null,
      } satisfies OwnedAsset;
    });
  }, [loadedTokenIds, accumulated.metadataByToken]);

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

  const isFetching = bootstrapFetching || pageFetching;

  const serverKeysReady =
    loadedTokenIds.length === 0 ||
    (pendingTokenIds.length === 0 && !isFetching);

  const unmatchedTokenIds = useMemo(() => {
    if (!address || !enabled || assets.length === 0 || !serverKeysReady) {
      return [];
    }
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
    enabled,
    assets,
    serverKeysReady,
    tokenToServerCollectionKey,
    seriesByCollectionKey,
  ]);

  const { data: deferredMintPreviews } = useQuery({
    queryKey: rq.marketMintPreviews(address ?? "", unmatchedTokenIds, chainId),
    queryFn: () => postBatchMintMarketPreviews(unmatchedTokenIds),
    enabled:
      Boolean(address && enabled) && unmatchedTokenIds.length > 0,
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!deferredMintPreviews) return;
    setAccumulated((prev) => ({
      ...prev,
      mintPreviews: { ...prev.mintPreviews, ...deferredMintPreviews },
    }));
  }, [deferredMintPreviews]);

  const mintPreviewByToken = useMemo(() => {
    return accumulated.mintPreviews as Record<
      number,
      CollectionMarketPreview | undefined
    >;
  }, [accumulated.mintPreviews]);

  const costBasisByTokenId = useMemo(() => {
    const m = new Map<number, number>();
    for (const item of accumulated.holdingsByToken.values()) {
      if (item.costBasisUsd != null && Number.isFinite(item.costBasisUsd)) {
        m.set(item.tokenId, item.costBasisUsd);
      }
    }
    return m;
  }, [accumulated.holdingsByToken]);

  const acquiredAtByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const item of accumulated.holdingsByToken.values()) {
      const iso = item.acquiredAt?.trim();
      if (iso) m.set(item.tokenId, iso);
    }
    return m;
  }, [accumulated.holdingsByToken]);

  const hiddenSet = useMemo(() => {
    const s = new Set<number>();
    for (const item of accumulated.holdingsByToken.values()) {
      if (item.hidden) s.add(item.tokenId);
    }
    return s;
  }, [accumulated.holdingsByToken]);

  useEffect(() => {
    if (!address?.trim() || ownedTokenIds.length === 0) return;
    const metadataItems = loadedTokenIds
      .filter((id) => accumulated.metadataByToken.has(id))
      .map((id) => {
        const a = accumulated.metadataByToken.get(id)!;
        return {
          tokenId: a.tokenId,
          metadata: a.metadata,
          imageUrl: a.imageUrl,
        };
      });
    persistPortfolioAccumulated({
      address,
      chainId,
      tokenIds: ownedTokenIds,
      bffLoadedCount,
      fetchedTokenIds: [...fetchedTokenIdsRef.current],
      metadataItems,
      collectionKeys: accumulated.collectionKeys,
      marketItems: accumulated.marketItems,
      holdings: [...accumulated.holdingsByToken.values()],
      mintPreviews: accumulated.mintPreviews,
      unmatchedMintTokenIds: unmatchedTokenIds,
    });
  }, [
    address,
    chainId,
    ownedTokenIds,
    bffLoadedCount,
    loadedTokenIds,
    accumulated.collectionKeys,
    accumulated.marketItems,
    accumulated.holdingsByToken,
    accumulated.metadataByToken,
    accumulated.mintPreviews,
    unmatchedTokenIds,
  ]);

  const valuesPending =
    Boolean(address) &&
    enabled &&
    loadedTokenIds.length > 0 &&
    (isFetching || pendingTokenIds.length > 0 || !serverKeysReady);

  /** Section skeleton only until owned token ids are known; cards fill in-place. */
  const isLoading = false;

  const idsLoading =
    enabled &&
    Boolean(address) &&
    ownedTokenIds.length === 0 &&
    (bootstrapFetching || !bootstrapFetched);

  const loadMoreAssets = useCallback(() => {
    if (loadedTokenIds.length >= ownedTokenIds.length) return;
    setBffLoadedCount((n) =>
      Math.min(ownedTokenIds.length, n + PORTFOLIO_ASSETS_PAGE_SIZE),
    );
  }, [loadedTokenIds.length, ownedTokenIds.length]);

  const isLoadingMoreAssets =
    pageFetching && pendingTokenIds.length > 0 && !bootstrapFetching;

  return {
    ownedTokenIds,
    loadedTokenIds,
    assets,
    tokenToCollectionKey,
    tokenToServerCollectionKey,
    uniqueCollectionKeys,
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken: mintPreviewByToken ?? EMPTY_MINT,
    costBasisByTokenId,
    acquiredAtByTokenId,
    hiddenSet,
    serverKeysReady,
    valuesPending,
    isLoading,
    idsLoading,
    isFetching,
    hasMoreAssets: loadedTokenIds.length < ownedTokenIds.length,
    loadMoreAssets,
    isLoadingMoreAssets,
  };
}
