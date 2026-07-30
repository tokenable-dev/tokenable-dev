"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminAnalyticsDashboard,
  rq,
  type AdminAnalyticsPeriod,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

export function useMarketplaceAdminAnalytics(days: AdminAnalyticsPeriod = 30) {
  const { chainId } = useAppChain();
  return useQuery({
    queryKey: rq.adminAnalytics(days, chainId),
    queryFn: () => getAdminAnalyticsDashboard(days),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
