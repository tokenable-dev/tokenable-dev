"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminAnalyticsDashboard,
  rq,
  type AdminAnalyticsPeriod,
} from "@/lib/core";

export function useMarketplaceAdminAnalytics(days: AdminAnalyticsPeriod = 30) {
  return useQuery({
    queryKey: rq.adminAnalytics(days),
    queryFn: () => getAdminAnalyticsDashboard(days),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
