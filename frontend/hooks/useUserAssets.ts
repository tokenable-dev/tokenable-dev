"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRwaTokensByOwner,
  postRwaMetadataBatch,
  postOrdersBatchByToken,
  getActiveOrders,
  postBatchMintPoketracePreviews,
  type CollectionPoketracePreview,
  type OrderListItem,
  type RwaMetadata,
} from "@/lib/api";
import { rq, marketplaceRqPolicy } from "@/lib/queryKeys";
import {
  primeRwaMetadataCache,
  getCachedRwaMetadata,
  getCachedRwaImageUrl,
} from "@/lib/rwaMetadataCache";

/** Stable fallbacks so `data ?? []` does not allocate new refs every render (avoids effect loops in consumers). */
const EMPTY_TOKEN_IDS: number[] = [];
const EMPTY_ORDER_LIST: OrderListItem[] = [];
const EMPTY_ORDER_HISTORY: Record<string, OrderListItem[]> = {};
const EMPTY_METADATA_ROWS: {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}[] = [];
const EMPTY_POKETRACE: Record<number, CollectionPoketracePreview> = {};

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
    includePoketrace?: boolean;
    /** When false, skip `GET /marketplace/orders` (default true). */
    loadMarketOrders?: boolean;
  },
) {
  const enabled = (opts?.enabled ?? true) && Boolean(address?.trim());
  const includeOrderHistory = opts?.includeOrderHistory ?? true;
  const includePoketrace = opts?.includePoketrace ?? true;

  const tokenIdsQuery = useQuery({
    queryKey: rq.rwaTokens(address!),
    queryFn: () => getRwaTokensByOwner(address!),
    enabled,
    staleTime: marketplaceRqPolicy.rwaTokensStaleMs,
  });

  const tokenIds = useMemo(
    () => tokenIdsQuery.data ?? EMPTY_TOKEN_IDS,
    [tokenIdsQuery.data],
  );

  const metadataQuery = useQuery({
    queryKey: rq.rwaMetadataBatch(address, tokenIds),
    queryFn: async () => {
      const pack = await postRwaMetadataBatch({ tokenIds });
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
    queryFn: () => postOrdersBatchByToken(tokenIds),
    enabled: enabled && includeOrderHistory && tokenIds.length > 0,
    staleTime: 30_000,
  });

  const poketraceQuery = useQuery({
    queryKey: rq.poketraceMintPreviews(address, tokenIds),
    queryFn: () => postBatchMintPoketracePreviews(tokenIds),
    enabled: enabled && includePoketrace && tokenIds.length > 0,
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
  const poketraceByToken = useMemo(
    () => poketraceQuery.data ?? EMPTY_POKETRACE,
    [poketraceQuery.data],
  );

  return {
    address,
    tokenIds,
    assets,
    activeOrders,
    orderHistoryByToken,
    historiesFlat,
    poketraceByToken,
    isLoadingIds: tokenIdsQuery.isLoading,
    isLoadingMetadata: metadataQuery.isLoading,
    isLoading: tokenIdsQuery.isLoading || metadataQuery.isLoading,
    poketraceLoading: poketraceQuery.isLoading,
    poketraceError: poketraceQuery.isError,
    refetchAll: () => {
      void tokenIdsQuery.refetch();
      void metadataQuery.refetch();
      void ordersQuery.refetch();
      void historyQuery.refetch();
      void poketraceQuery.refetch();
    },
  };
}
