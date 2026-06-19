"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getRwaTokenTrades,
  marketplaceRqPolicy,
  rq,
  type CollectionPlatformTapeFill,
} from "@/lib/core";
import {
  marketHistoryTierFromRwaMetadata,
  marketTierDisplayLabel,
} from "@/lib/market";
import { countableTapeFills } from "@/lib/market/tradesVolume";

export function useRwaDetailPlatformTrades(input: {
  tokenId: number;
  tokenIdOk: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  const { tokenId, tokenIdOk, metadata } = input;

  const gradeLabel = useMemo(() => {
    if (!metadata) return undefined;
    return marketTierDisplayLabel(marketHistoryTierFromRwaMetadata(metadata));
  }, [metadata]);

  const { data, isLoading } = useQuery({
    queryKey: rq.rwaTokenTrades(tokenId, gradeLabel),
    queryFn: () => getRwaTokenTrades(tokenId, { grade: gradeLabel }),
    enabled: tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const trades = useMemo((): CollectionPlatformTapeFill[] => {
    return [...countableTapeFills(data?.trades ?? [])].sort((a, b) => b.t - a.t);
  }, [data?.trades]);

  return {
    trades,
    tradesLoading: Boolean(tokenIdOk && isLoading),
    tradesAvailable: tokenIdOk,
  };
}
