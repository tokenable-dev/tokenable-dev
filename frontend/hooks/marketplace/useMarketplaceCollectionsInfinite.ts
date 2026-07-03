"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionsPage,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
} from "@/lib/core";

export function useMarketplaceCollectionsInfinite(opts?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: rq.collectionsMarketplace(),
    queryFn: ({ pageParam }) =>
      getMarketplaceCollectionsPage({
        cursor: pageParam as string | null,
        limit: 30,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: opts?.enabled ?? true,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    // Catalog data is stable; skip the background refetch on tab-focus/reconnect.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });
}
