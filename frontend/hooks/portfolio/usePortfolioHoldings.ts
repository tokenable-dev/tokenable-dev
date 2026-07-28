"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postPortfolioHoldingsBatch,
  rq,
  marketplaceRqPolicy,
  type PortfolioHoldingBatchItem,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

/**
 * Server-backed portfolio holdings prefs (hide + cost basis) for owned tokenIds.
 */
export function usePortfolioHoldings(
  address: string | undefined,
  tokenIds: readonly number[],
  enabled: boolean,
) {
  const chainId = activeRqChainId();
  const sortedTokenIds = useMemo(
    () => [...tokenIds].slice().sort((a, b) => a - b),
    [tokenIds],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: rq.portfolioHoldings(address ?? "", sortedTokenIds, chainId),
    queryFn: () => postPortfolioHoldingsBatch(address!, sortedTokenIds),
    enabled: enabled && Boolean(address) && sortedTokenIds.length > 0,
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const holdingsByTokenId = useMemo(() => {
    const m = new Map<number, PortfolioHoldingBatchItem>();
    for (const item of data?.items ?? []) {
      m.set(item.tokenId, item);
    }
    return m;
  }, [data]);

  const costBasisByTokenId = useMemo(() => {
    const m = new Map<number, number>();
    for (const item of data?.items ?? []) {
      if (item.costBasisUsd != null && Number.isFinite(item.costBasisUsd)) {
        m.set(item.tokenId, item.costBasisUsd);
      }
    }
    return m;
  }, [data]);

  const hiddenTokenIds = useMemo(() => {
    const ids: number[] = [];
    for (const item of data?.items ?? []) {
      if (item.hidden) ids.push(item.tokenId);
    }
    return ids;
  }, [data]);

  const hiddenSet = useMemo(() => new Set(hiddenTokenIds), [hiddenTokenIds]);

  return {
    holdingsByTokenId,
    costBasisByTokenId,
    hiddenTokenIds,
    hiddenSet,
    loading: isLoading || isFetching,
  };
}
