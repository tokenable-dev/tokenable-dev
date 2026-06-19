"use client";

import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { getMarketplaceCollectionsPage, postAdminDeleteCollection, rq } from "@/lib/core";
import { useAdminCollectionMarketSnapshots } from "./useAdminCollectionMarketSnapshots";

const PAGE_SIZE = 30;

export function useMarketplaceAdminCollections(adminWallet: Address | undefined) {
  const qc = useQueryClient();
  const wallet = adminWallet?.toLowerCase();

  const listQuery = useInfiniteQuery({
    queryKey: rq.adminCollectionsList(),
    queryFn: ({ pageParam }) =>
      getMarketplaceCollectionsPage({
        cursor: pageParam ?? null,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });

  const items = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data?.pages],
  );

  const collectionKeys = useMemo(
    () => items.map((c) => c.collectionKey),
    [items],
  );

  const { byKey: snapshotByKey, query: snapshotsQuery } =
    useAdminCollectionMarketSnapshots(collectionKeys);

  async function invalidateCollections(collectionKey?: string) {
    await qc.invalidateQueries({ queryKey: rq.adminCollectionsList() });
    await qc.invalidateQueries({ queryKey: rq.collectionsMarketplace() });
    if (collectionKey) {
      await qc.invalidateQueries({
        queryKey: rq.collectionDetail(collectionKey.toLowerCase()),
      });
    }
  }

  async function deleteCollection(collectionKey: string, confirmKey: string) {
    if (!wallet) throw new Error("Admin wallet required");
    const result = await postAdminDeleteCollection(collectionKey, {
      adminWallet: wallet,
      confirmCollectionKey: confirmKey,
    });
    await invalidateCollections(collectionKey);
    return result;
  }

  return {
    listQuery,
    items,
    snapshotByKey,
    snapshotsQuery,
    deleteCollection,
    invalidateCollections,
    hasMore: Boolean(listQuery.hasNextPage),
    loadMore: () => listQuery.fetchNextPage(),
    isLoadingMore: listQuery.isFetchingNextPage,
  };
}
