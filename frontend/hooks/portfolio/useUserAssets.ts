"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
  },
) {
  const enabled = (opts?.enabled ?? true) && Boolean(address?.trim());
  const includeOrderHistory = opts?.includeOrderHistory ?? true;
  const includeMarketPreview = opts?.includeMarketPreview ?? true;

  const tokenIdsQuery = useQuery({
    queryKey: rq.rwaTokens(address!),
    queryFn: () => getRwaTokensByOwner(address!),
    enabled,
    staleTime: marketplaceRqPolicy.rwaTokensStaleMs,
  });

  const tokenIds = useMemo(() => {
    const raw = tokenIdsQuery.data ?? EMPTY_TOKEN_IDS;
    return [...new Set(raw)];
  }, [tokenIdsQuery.data]);

  const metadataQuery = useQuery({
    queryKey: rq.rwaMetadataBatch(address, tokenIds),
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
    enabled: enabled && tokenIds.length > 0,
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
    placeholderData: keepPreviousData,
  });

  const ordersQuery = useQuery({
    queryKey: rq.ordersActive(),
    queryFn: getActiveOrders,
    enabled: enabled && (opts?.loadMarketOrders ?? true),
    refetchInterval: marketplaceRqPolicy.ordersRefetchMs,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const historyQuery = useQuery({
    queryKey: rq.ordersByTokenBatch(address, tokenIds),
    queryFn: () => postOrdersBatchByTokenBatched(tokenIds),
    enabled: enabled && includeOrderHistory && tokenIds.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const marketPreviewQuery = useQuery({
    queryKey: rq.marketMintPreviews(address, tokenIds),
    queryFn: () => postBatchMintMarketPreviews(tokenIds),
    enabled: enabled && includeMarketPreview && tokenIds.length > 0,
    placeholderData: keepPreviousData,
  });

  const assets: UserOwnedAsset[] = useMemo(() => {
    const rows = metadataQuery.data ?? EMPTY_METADATA_ROWS;
    const byToken = new Map(rows.map((row) => [row.tokenId, row]));
    return tokenIds.map((tokenId) => {
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
  }, [tokenIds, metadataQuery.data]);

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

  return {
    address,
    tokenIds,
    assets,
    activeOrders,
    orderHistoryByToken,
    historiesFlat,
    marketPreviewByToken,
    isLoadingIds: tokenIdsQuery.isLoading,
    isLoadingMetadata: metadataQuery.isLoading,
    isLoadingHistoryBatch: historyQuery.isLoading,
    isLoading: tokenIdsQuery.isLoading || metadataQuery.isLoading,
    marketPreviewLoading: marketPreviewQuery.isLoading,
    marketPreviewError: marketPreviewQuery.isError,
    refetchAll: () => {
      void tokenIdsQuery.refetch();
      void metadataQuery.refetch();
      void ordersQuery.refetch();
      void historyQuery.refetch();
      void marketPreviewQuery.refetch();
    },
    /** Refetch only the global order book — use after listing/bid mutations to avoid refetching metadata/previews (reduces UI flicker). */
    refetchActiveOrders: () => ordersQuery.refetch(),
  };
}
