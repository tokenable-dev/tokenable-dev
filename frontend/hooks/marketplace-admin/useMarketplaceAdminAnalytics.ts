"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminAnalyticsDashboard,
  rq,
  type AdminAnalyticsPeriod,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

/** Heavy SQL aggregates — cache longer; refresh via period selector / Refresh. */
export function useMarketplaceAdminAnalytics(days: AdminAnalyticsPeriod = 30) {
  const { chainId } = useAppChain();
  return useQuery({
    queryKey: rq.adminAnalytics(days, chainId),
    queryFn: () => getAdminAnalyticsDashboard(days),
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
