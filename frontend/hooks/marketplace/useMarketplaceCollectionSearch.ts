"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionsPage,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

const SEARCH_LIMIT = 40;
const DEBOUNCE_MS = 200;

/** Debounced server-side collection search for the GNB header. */
export function useMarketplaceCollectionSearch(
  query: string,
  opts?: { enabled?: boolean },
) {
  const chainId = activeRqChainId();
  const [debouncedQ, setDebouncedQ] = useState(() => String(query ?? "").trim());

  useEffect(() => {
    const trimmed = String(query ?? "").trim();
    const t = window.setTimeout(() => setDebouncedQ(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const enabled =
    (opts?.enabled ?? true) && debouncedQ.length > 0;

  const result = useQuery({
    queryKey: rq.collectionsSearch(chainId, debouncedQ),
    queryFn: () =>
      getMarketplaceCollectionsPage({
        q: debouncedQ,
        limit: SEARCH_LIMIT,
      }),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const items = Array.isArray(result.data?.items) ? result.data.items : [];
  const isPendingQuery = String(query ?? "").trim() !== debouncedQ;

  return {
    items,
    /** True while debounce waits or the request is in flight. */
    isSearching:
      enabled && (isPendingQuery || result.isFetching || result.isLoading),
    isError: result.isError,
    debouncedQ,
    truncated: items.length >= SEARCH_LIMIT,
  };
}
