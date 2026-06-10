"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCollectionPlatformTrades,
  marketplaceRqPolicy,
  rq,
  type CollectionPlatformTapeFill,
} from "@/lib/core";
import { countableTapeFills } from "@/lib/market/tradesVolume";

export function useRwaDetailPlatformTrades(input: {
  tokenIdOk: boolean;
  collectionKey: string | null;
}) {
  const { tokenIdOk, collectionKey } = input;

  const { data, isLoading } = useQuery({
    queryKey: rq.collectionPlatformTrades(collectionKey ?? ""),
    queryFn: () => getCollectionPlatformTrades(collectionKey!),
    enabled: Boolean(collectionKey && tokenIdOk),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const trades = useMemo((): CollectionPlatformTapeFill[] => {
    return [...countableTapeFills(data?.trades ?? [])].sort((a, b) => b.t - a.t);
  }, [data?.trades]);

  return {
    trades,
    tradesLoading: Boolean(collectionKey && tokenIdOk && isLoading),
    tradesAvailable: Boolean(collectionKey),
  };
}
