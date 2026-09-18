"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getCollectionAiInsight,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
  type CollectionAiInsightResponse,
} from "@/lib/core";

export function useCollectionAiInsight(
  collectionKey: string,
  opts?: { enabled?: boolean },
) {
  const enabled = (opts?.enabled ?? true) && collectionKey.length > 0;
  const [showContent, setShowContent] = useState(false);

  const query = useQuery({
    queryKey: rq.collectionAiInsight(collectionKey),
    queryFn: () => getCollectionAiInsight(collectionKey),
    enabled,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  useEffect(() => {
    if (!enabled) {
      setShowContent(false);
      return;
    }
    if (query.isLoading || query.isFetching) {
      setShowContent(false);
      return;
    }
    if (!query.data) return;

    const minMs = query.data.uiInstructions?.loading?.minDurationMs ?? 600;
    const t = window.setTimeout(() => setShowContent(true), minMs);
    return () => window.clearTimeout(t);
  }, [enabled, query.isLoading, query.isFetching, query.data]);

  const loading =
    enabled &&
    (query.isLoading || query.isFetching || (query.data != null && !showContent));

  return {
    ...query,
    loading,
    insight: query.data as CollectionAiInsightResponse | undefined,
  };
}
