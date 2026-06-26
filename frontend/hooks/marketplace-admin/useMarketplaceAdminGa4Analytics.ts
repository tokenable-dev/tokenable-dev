"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminGa4Analytics,
  rq,
  type AdminAnalyticsPeriod,
} from "@/lib/core";

export function useMarketplaceAdminGa4Analytics(days: AdminAnalyticsPeriod = 30) {
  return useQuery({
    queryKey: rq.adminGa4Analytics(days),
    queryFn: () => getAdminGa4Analytics(days),
    staleTime: 120_000,
    refetchInterval: 180_000,
    retry: 1,
  });
}
