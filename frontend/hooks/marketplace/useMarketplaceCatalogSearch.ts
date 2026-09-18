"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMarketplaceSearch,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

const DEBOUNCE_MS = 200;

/** Debounced catalog search: individual cards + collections. */
export function useMarketplaceCatalogSearch(
  query: string,
  opts?: { enabled?: boolean; cardLimit?: number; collectionLimit?: number },
) {
  const chainId = activeRqChainId();
  const [debouncedQ, setDebouncedQ] = useState(() => String(query ?? "").trim());

  useEffect(() => {
    const trimmed = String(query ?? "").trim();
    const t = window.setTimeout(() => setDebouncedQ(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const enabled = (opts?.enabled ?? true) && debouncedQ.length > 0;
  const cardLimit = opts?.cardLimit ?? 8;
  const collectionLimit = opts?.collectionLimit ?? 8;

  const result = useQuery({
    queryKey: [...rq.catalogSearch(chainId, debouncedQ), cardLimit, collectionLimit],
    queryFn: () =>
      getMarketplaceSearch({
        q: debouncedQ,
        cardLimit,
        collectionLimit,
      }),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const cards = Array.isArray(result.data?.cards) ? result.data.cards : [];
  const collections = Array.isArray(result.data?.collections)
    ? result.data.collections
    : [];
  const isPendingQuery = String(query ?? "").trim() !== debouncedQ;

  return {
    cards,
    collections,
    isSearching:
      enabled && (isPendingQuery || result.isFetching || result.isLoading),
    isError: result.isError,
    debouncedQ,
    truncated:
      collections.length >= collectionLimit || cards.length >= cardLimit,
  };
}
