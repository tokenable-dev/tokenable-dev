"use client";

import { useCallback, useMemo } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import {
  getRwaTokensByOwner,
  postRwaMetadataBatchBatched,
  postOrdersBatchByTokenBatched,
  getActiveOrders,
  postBatchMintMarketPreviews,
  type CollectionMarketPreview,
  type OrderListItem,
  type RwaMetadata,
} from "@/lib/core";
import { rq, marketplaceRqPolicy } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  primeRwaMetadataCache,
  getCachedRwaMetadata,
  getCachedRwaImageUrl,
} from "@/lib/marketplace";

/** Stable fallbacks so `data ?? []` does not allocate new refs every render (avoids effect loops in consumers). */
const EMPTY_TOKEN_IDS: number[] = [];
const EMPTY_ORDER_LIST: OrderListItem[] = [];
const EMPTY_ORDER_HISTORY: Record<string, OrderListItem[]> = {};
const EMPTY_METADATA_ROWS: {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}[] = [];
const EMPTY_MARKET_PREVIEW: Record<number, CollectionMarketPreview> = {};

/** Default My Assets page size when portfolio enables progressive metadata. */
export const PORTFOLIO_ASSETS_PAGE_SIZE = 50;

export interface UserOwnedAsset {
  tokenId: number;
  metadata: RwaMetadata | null;
  /** Resolved https URL from server (no client IPFS gateway). */
  imageUrl: string | null;
}

export function useUserAssets(
  address: string | undefined,
  opts?: {
    enabled?: boolean;
    includeOrderHistory?: boolean;
    includeMarketPreview?: boolean;
    /** When false, skip `GET /marketplace/orders` (default true). */
    loadMarketOrders?: boolean;
    /** Keep prior page data while the owner address changes (default true). */
    retainPreviousOwner?: boolean;
    /**
     * When set, metadata loads in pages (newest tokenId first).
     * Use `loadMoreAssets` / `hasMoreAssets` for a Load more control.
     */
    assetPageSize?: number;
  },
) {
  const enabled = (opts?.enabled ?? true) && Boolean(address?.trim());
  const includeOrderHistory = opts?.includeOrderHistory ?? true;
  const includeMarketPreview = opts?.includeMarketPreview ?? true;
  const retainPreviousOwner = opts?.retainPreviousOwner ?? true;
  const previousOwnerPlaceholder = retainPreviousOwner ? keepPreviousData : undefined;
  const chainId = activeRqChainId();
  const pageSize =
    typeof opts?.assetPageSize === "number" && opts.assetPageSize > 0
      ? Math.floor(opts.assetPageSize)
      : null;
  const paged = pageSize != null;

  const tokenIdsQuery = useQuery({
    queryKey: rq.rwaTokens(address!, chainId),
    queryFn: () => getRwaTokensByOwner(address!),
    enabled,
    staleTime: marketplaceRqPolicy.rwaTokensStaleMs,
  });

  const tokenIds = useMemo(() => {
    const raw = tokenIdsQuery.data ?? EMPTY_TOKEN_IDS;
    const unique = [...new Set(raw)];
    // Newest mints first (token id grows with mint); portfolio UI defaults to recent-first.
    unique.sort((a, b) => b - a);
    return unique;
  }, [tokenIdsQuery.data]);

  const pagedMetadataQuery = useInfiniteQuery({
    queryKey: [
      ...rq.rwaMetadataBatch(address, tokenIds, chainId),
      "infinite",
      pageSize,
    ] as const,
    queryFn: async ({ pageParam }) => {
      const start = pageParam;
      const slice = tokenIds.slice(start, start + pageSize!);
      const pack = await postRwaMetadataBatchBatched(slice);
      primeRwaMetadataCache(
        pack.items.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      return { start, slice, items: pack.items };
    },
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.start + last.slice.length;
      return next < tokenIds.length ? next : undefined;
    },
    enabled: enabled && paged && tokenIds.length > 0,
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
    placeholderData: previousOwnerPlaceholder,
  });

  const fullMetadataQuery = useQuery({
    queryKey: rq.rwaMetadataBatch(address, tokenIds, chainId),
    queryFn: async () => {
      const pack = await postRwaMetadataBatchBatched(tokenIds);
      primeRwaMetadataCache(
        pack.items.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      return pack.items;
    },
    enabled: enabled && !paged && tokenIds.length > 0,
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
    placeholderData: previousOwnerPlaceholder,
  });

  const loadedTokenIds = useMemo(() => {
    if (!paged) return tokenIds;
    const ids: number[] = [];
    for (const page of pagedMetadataQuery.data?.pages ?? []) {
      ids.push(...page.slice);
    }
    return ids;
  }, [paged, tokenIds, pagedMetadataQuery.data?.pages]);

  const metadataRows = useMemo(() => {
    if (!paged) return fullMetadataQuery.data ?? EMPTY_METADATA_ROWS;
    const rows: {
      tokenId: number;
      metadata: RwaMetadata | null;
      imageUrl: string | null;
    }[] = [];
    for (const page of pagedMetadataQuery.data?.pages ?? []) {
      rows.push(...page.items);
    }
    return rows;
  }, [paged, fullMetadataQuery.data, pagedMetadataQuery.data?.pages]);

  const ordersQuery = useQuery({
    queryKey: rq.ordersActive(chainId),
    queryFn: getActiveOrders,
    enabled: enabled && (opts?.loadMarketOrders ?? true),
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const historyQuery = useQuery({
    queryKey: rq.ordersByTokenBatch(address, tokenIds, chainId),
    queryFn: () => postOrdersBatchByTokenBatched(tokenIds),
    enabled: enabled && includeOrderHistory && tokenIds.length > 0,
    staleTime: 30_000,
    placeholderData: previousOwnerPlaceholder,
  });

  const marketPreviewQuery = useQuery({
    queryKey: rq.marketMintPreviews(address, tokenIds, chainId),
    queryFn: () => postBatchMintMarketPreviews(tokenIds),
    enabled: enabled && includeMarketPreview && tokenIds.length > 0,
    placeholderData: previousOwnerPlaceholder,
  });

  const assets: UserOwnedAsset[] = useMemo(() => {
    const byToken = new Map(metadataRows.map((row) => [row.tokenId, row]));
    const ids = paged ? loadedTokenIds : tokenIds;
    return ids.map((tokenId) => {
      const row = byToken.get(tokenId);
      if (row) {
        return {
          tokenId,
          metadata: row.metadata,
          imageUrl: row.imageUrl ?? null,
        };
      }
      return {
        tokenId,
        metadata: (getCachedRwaMetadata(tokenId) as RwaMetadata | null) ?? null,
        imageUrl: getCachedRwaImageUrl(tokenId),
      };
    });
  }, [paged, loadedTokenIds, tokenIds, metadataRows]);

  const historiesFlat: OrderListItem[] = useMemo(() => {
    const m = historyQuery.data ?? EMPTY_ORDER_HISTORY;
    return Object.values(m).flat();
  }, [historyQuery.data]);

  const activeOrders = useMemo(
    () => ordersQuery.data ?? EMPTY_ORDER_LIST,
    [ordersQuery.data],
  );
  const orderHistoryByToken = useMemo(
    () => historyQuery.data ?? EMPTY_ORDER_HISTORY,
    [historyQuery.data],
  );
  const marketPreviewByToken = useMemo(
    () => marketPreviewQuery.data ?? EMPTY_MARKET_PREVIEW,
    [marketPreviewQuery.data],
  );

  const isLoadingMetadata = paged
    ? pagedMetadataQuery.isLoading
    : fullMetadataQuery.isLoading;
  const hasMoreAssets = paged
    ? Boolean(pagedMetadataQuery.hasNextPage)
    : false;
  const isLoadingMoreAssets = paged
    ? pagedMetadataQuery.isFetchingNextPage
    : false;

  const loadMoreAssets = useCallback(() => {
    if (!paged || !pagedMetadataQuery.hasNextPage) return;
    if (pagedMetadataQuery.isFetchingNextPage) return;
    void pagedMetadataQuery.fetchNextPage();
  }, [paged, pagedMetadataQuery]);

  return {
    address,
    tokenIds,
    /** Token IDs that already have a metadata page loaded (paged mode). */
    loadedTokenIds,
    assets,
    activeOrders,
    orderHistoryByToken,
    historiesFlat,
    marketPreviewByToken,
    isLoadingIds: tokenIdsQuery.isLoading,
    isLoadingMetadata,
    isLoadingHistoryBatch: historyQuery.isLoading,
    isLoading: tokenIdsQuery.isLoading || isLoadingMetadata,
    hasMoreAssets,
    isLoadingMoreAssets,
    loadMoreAssets,
    marketPreviewLoading: marketPreviewQuery.isLoading,
    marketPreviewError: marketPreviewQuery.isError,
    refetchAll: () => {
      void tokenIdsQuery.refetch();
      if (paged) void pagedMetadataQuery.refetch();
      else void fullMetadataQuery.refetch();
      void ordersQuery.refetch();
      void historyQuery.refetch();
      void marketPreviewQuery.refetch();
    },
    /** Refetch only the global order book — use after listing/bid mutations to avoid refetching metadata/previews (reduces UI flicker). */
    refetchActiveOrders: () => ordersQuery.refetch(),
  };
}
