"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionsPage,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

export function useMarketplaceCollectionsInfinite(opts?: { enabled?: boolean }) {
  const chainId = activeRqChainId();
  return useInfiniteQuery({
    queryKey: rq.collectionsMarketplace(chainId),
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
