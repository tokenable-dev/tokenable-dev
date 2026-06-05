"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCollectionPlatformTrades,
  marketplaceRqPolicy,
  rq,
  type CollectionPlatformTapeFill,
} from "@/lib/core";

export function useRwaDetailPlatformTrades(input: {
  tokenId: number;
  tokenIdOk: boolean;
  collectionKey: string | null;
}) {
  const { tokenId, tokenIdOk, collectionKey } = input;

  const { data, isLoading } = useQuery({
    queryKey: rq.collectionPlatformTrades(collectionKey ?? ""),
    queryFn: () => getCollectionPlatformTrades(collectionKey!),
    enabled: Boolean(collectionKey && tokenIdOk),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const trades = useMemo((): CollectionPlatformTapeFill[] => {
    const raw = data?.trades ?? [];
    const tid = String(tokenId);
    // Platform fills are per tokenId; Cardhedger comps use tokenId "—" (catalog-grade market sales).
    return raw
      .filter(
        (row) =>
          row.source === "cardhedger" || String(row.tokenId) === tid,
      )
      .sort((a, b) => b.t - a.t);
  }, [data?.trades, tokenId]);

  return {
    trades,
    tradesLoading: Boolean(collectionKey && tokenIdOk && isLoading),
    tradesAvailable: Boolean(collectionKey),
  };
}
