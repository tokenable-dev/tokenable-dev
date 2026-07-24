"use client";

import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCollectionReviewCounts,
  getMarketplaceCollectionsPage,
  postAdminSetCollectionReviewStatus,
  type CollectionReviewStatus,
  type CollectionReviewStatusFilter,
} from "@/lib/core";
import { rq } from "@/lib/core";
import { useAdminCollectionMarketSnapshots } from "./useAdminCollectionMarketSnapshots";

const PAGE_SIZE = 30;

export function useMarketplaceAdminCollections() {
  const qc = useQueryClient();
  const [reviewFilter, setReviewFilter] =
    useState<CollectionReviewStatusFilter>("pending_review");

  const listQuery = useInfiniteQuery({
    queryKey: [...rq.adminCollectionsList(), reviewFilter] as const,
    queryFn: ({ pageParam }) =>
      getMarketplaceCollectionsPage({
        cursor: pageParam ?? null,
        limit: PAGE_SIZE,
        reviewStatus: reviewFilter,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });

  const countsQuery = useQuery({
    queryKey: [...rq.adminCollectionsList(), "review-counts"] as const,
    queryFn: () => getAdminCollectionReviewCounts(),
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

  async function setReviewStatus(
    collectionKey: string,
    reviewStatus: CollectionReviewStatus,
  ) {
    const result = await postAdminSetCollectionReviewStatus(collectionKey, {
      reviewStatus,
    });
    await invalidateCollections(collectionKey);
    return result;
  }

  return {
    reviewFilter,
    setReviewFilter,
    counts: countsQuery.data,
    countsLoading: countsQuery.isLoading,
    listQuery,
    items,
    snapshotByKey,
    snapshotsQuery,
    setReviewStatus,
    invalidateCollections,
    hasMore: Boolean(listQuery.hasNextPage),
    loadMore: () => listQuery.fetchNextPage(),
    isLoadingMore: listQuery.isFetchingNextPage,
  };
}
