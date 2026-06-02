"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioHiddenHoldings, rq, marketplaceRqPolicy } from "@/lib/core";

/**
 * Fetches and derives the hidden token set for the portfolio page.
 * The `hiddenSet` is a stable `Set<number>` for O(1) visibility checks.
 */
export function usePortfolioHiddenHoldings(
  address: string | undefined,
  isConnected: boolean,
) {
  const { data: hiddenTokenIds = [] } = useQuery({
    queryKey: rq.portfolioHidden(address ?? ""),
    queryFn: () => getPortfolioHiddenHoldings(address!),
    enabled: Boolean(address && isConnected),
    staleTime: marketplaceRqPolicy.ordersStaleMs,
  });

  const hiddenSet = useMemo(() => new Set(hiddenTokenIds), [hiddenTokenIds]);

  return { hiddenTokenIds, hiddenSet };
}
