"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  postBatchMintMarketPreviews,
  postPortfolioAssetsPage,
  postPortfolioHoldingsBatch,
  rq,
  type CollectionMarketSeries,
  type OrderListItem,
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
  mergeHoldingRowsPreferLiveBuy,
  persistPortfolioAccumulated,
  paintedMarketplaceBuyTokenIds,
  readPortfolioBundle,
  readPortfolioBffLoadedCount,
} from "@/lib/portfolio/portfolioQueryPersistence";
import {
  gradeScoreFromMetadata,
  portfolioSnapshotCanPriceHoldings,
} from "@/lib/portfolio/portfolioAssetMeta";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import type { RwaMetadata } from "@/lib/core";
import {
  PORTFOLIO_ASSETS_FIRST_PAINT,
  PORTFOLIO_ASSETS_PAGE_MAX,
} from "@/lib/core/api/portfolio-assets-page";

const EMPTY_MINT: Record<number, CollectionMarketPreview | undefined> = {};

/** Load-more step — matches backend `PORTFOLIO_ASSETS_PAGE_MAX`. */
export const PORTFOLIO_ASSETS_PAGE_SIZE = PORTFOLIO_ASSETS_PAGE_MAX;

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

  const holdingsByToken = new Map(
    mergeHoldingRowsPreferLiveBuy(
      pageData.holdings,
      [...prev.holdingsByToken.values()],
    ).map((h) => [h.tokenId, h]),
  );

  return {
    metadataByToken,
    collectionKeys,
    marketItems: [...marketByKey.values()],
    holdingsByToken,
    mintPreviews: prev.mintPreviews,
  };
}

/**
 * My Assets BFF — fast owned-ids bootstrap, then incremental metadata pages.
 * localStorage paints instantly on refresh; cold visits get shells as soon as
 * ownedTokenIds return (DB list-ready metadata fills next — IPFS only for stubs).
 */
export function usePortfolioAssetsPage(input: {
  address: string | undefined;
  enabled: boolean;
  listingCollectionKeyByToken: Map<number, string>;
}) {
  const { address, enabled, listingCollectionKeyByToken } = input;
  const chainId = activeRqChainId();
  const queryClient = useQueryClient();

  const fetchedTokenIdsRef = useRef<Set<number>>(new Set());
  const bootstrapDoneRef = useRef(false);
  const hadPaintCacheRef = useRef(false);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const [ownedTokenIds, setOwnedTokenIds] = useState<number[]>([]);
  const [accumulated, setAccumulated] = useState(emptyAccumulated);
  const [bffLoadedCount, setBffLoadedCount] = useState(PORTFOLIO_ASSETS_FIRST_PAINT);

  const resetForWallet = () => {
    fetchedTokenIdsRef.current = new Set();
    bootstrapDoneRef.current = false;
    hadPaintCacheRef.current = false;
    setOwnedTokenIds([]);
    setAccumulated(emptyAccumulated());
    setBffLoadedCount(PORTFOLIO_ASSETS_FIRST_PAINT);
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
    // Instant paint from cache — server ids bootstrap still runs to pick up new mints.
    hadPaintCacheRef.current = bundle.tokenIds.length > 0;
    const restored = accumulatedFromPortfolioBundle(bundle);
    fetchedTokenIdsRef.current = new Set(restored.fetchedTokenIds);
    bootstrapDoneRef.current = bundle.tokenIds.length > 0;
    setOwnedTokenIds(bundle.tokenIds);
    setBffLoadedCount(
      readPortfolioBffLoadedCount(address, chainId, PORTFOLIO_ASSETS_FIRST_PAINT),
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
    data: ownedIdsData,
    isFetching: ownedIdsFetching,
    isFetched: ownedIdsFetched,
    isError: ownedIdsError,
    isSuccess: ownedIdsSuccess,
  } = useQuery({
    queryKey: rq.portfolioAssetsPageBootstrap(address ?? "", chainId),
    queryFn: () =>
      postPortfolioAssetsPage({
        walletAddress: address!,
        ownedIdsOnly: true,
      }),
    enabled: Boolean(address && enabled),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 2,
  });

  useEffect(() => {
    if (!ownedIdsFetched) return;

    // Network failure: keep localStorage paint — never flash a false empty wallet.
    if (ownedIdsError || !ownedIdsSuccess || !ownedIdsData) {
      if (hadPaintCacheRef.current || ownedTokenIds.length > 0) {
        bootstrapDoneRef.current = true;
      }
      return;
    }

    bootstrapDoneRef.current = true;
    const serverIds = ownedIdsData.ownedTokenIds ?? [];
    const paintedBuys = paintedMarketplaceBuyTokenIds(
      readPortfolioBundle(address ?? "", chainId)?.holdings,
    );
    setOwnedTokenIds([...new Set([...serverIds, ...paintedBuys])]);
    setFetchGeneration((g) => g + 1);
  }, [ownedIdsFetched, ownedIdsSuccess, ownedIdsError, ownedIdsData, ownedTokenIds.length, address, chainId]);

  const loadedTokenIds = useMemo(() => {
    return ownedTokenIds.slice(0, Math.max(0, bffLoadedCount));
  }, [ownedTokenIds, bffLoadedCount]);

  const pendingTokenIds = useMemo(() => {
    void fetchGeneration;
    return loadedTokenIds.filter((id) => !fetchedTokenIdsRef.current.has(id));
  }, [loadedTokenIds, fetchGeneration]);

  const holdingsLiveIds = loadedTokenIds;
  const { data: holdingsLive } = useQuery({
    queryKey: rq.portfolioHoldings(address ?? "", holdingsLiveIds, chainId),
    queryFn: () => postPortfolioHoldingsBatch(address!, holdingsLiveIds),
    enabled:
      Boolean(address && enabled) &&
      holdingsLiveIds.length > 0 &&
      ownedIdsFetched &&
      ownedIdsSuccess,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    const items = holdingsLive?.items;
    if (!items?.length) return;
    setAccumulated((prev) => ({
      ...prev,
      holdingsByToken: new Map(
        mergeHoldingRowsPreferLiveBuy(items, [
          ...prev.holdingsByToken.values(),
        ]).map((h) => [h.tokenId, h]),
      ),
    }));
  }, [holdingsLive]);

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
    retry: 2,
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

  const isFetching = ownedIdsFetching || pageFetching;

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
          gradeScoreFromMetadata(a.metadata),
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

  const {
    data: deferredMintPreviews,
    isFetching: mintPreviewFetching,
    isFetched: mintPreviewFetched,
  } = useQuery({
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
      ordersAsk: queryClient.getQueryData<OrderListItem[]>(
        rq.ordersByOfferer(address, "ask", chainId),
      ),
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
    queryClient,
  ]);

  const mintPreviewsPending =
    unmatchedTokenIds.length > 0 &&
    (mintPreviewFetching || !mintPreviewFetched);

  const valuesPending =
    Boolean(address) &&
    enabled &&
    loadedTokenIds.length > 0 &&
    (isFetching ||
      pendingTokenIds.length > 0 ||
      !serverKeysReady ||
      mintPreviewsPending);

  /** Section skeleton only until owned token ids are known; cards fill in-place. */
  const isLoading = false;

  const idsLoading =
    enabled &&
    Boolean(address) &&
    ownedTokenIds.length === 0 &&
    !hadPaintCacheRef.current &&
    (ownedIdsFetching || !ownedIdsFetched);

  const applyCostBasis = useCallback(
    (tokenId: number, costBasisUsd: number) => {
      const usd = Number(costBasisUsd);
      if (!Number.isFinite(usd) || usd < 0) return;
      setAccumulated((prev) => {
        const holdingsByToken = new Map(prev.holdingsByToken);
        const prevRow = holdingsByToken.get(tokenId);
        holdingsByToken.set(tokenId, {
          tokenId,
          hidden: prevRow?.hidden ?? false,
          costBasisUsd: usd,
          costBasisSource: "manual",
          acquiredAt: prevRow?.acquiredAt ?? new Date().toISOString(),
        });
        return { ...prev, holdingsByToken };
      });
    },
    [],
  );

  const loadMoreAssets = useCallback(() => {
    if (loadedTokenIds.length >= ownedTokenIds.length) return;
    setBffLoadedCount((n) =>
      Math.min(ownedTokenIds.length, n + PORTFOLIO_ASSETS_PAGE_SIZE),
    );
  }, [loadedTokenIds.length, ownedTokenIds.length]);

  const isLoadingMoreAssets =
    pageFetching && pendingTokenIds.length > 0 && !ownedIdsFetching;

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
    applyCostBasis,
  };
}
