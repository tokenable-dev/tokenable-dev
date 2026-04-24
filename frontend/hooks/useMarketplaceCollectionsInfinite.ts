"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getMarketplaceCollectionsPage } from "@/lib/api";
import { rq, marketplaceRqPolicy } from "@/lib/queryKeys";

export function useMarketplaceCollectionsInfinite() {
  return useInfiniteQuery({
    queryKey: rq.collectionsMarketplace(),
    queryFn: ({ pageParam }) =>
      getMarketplaceCollectionsPage({
        cursor: pageParam as string | null,
        limit: 30,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
  });
}
