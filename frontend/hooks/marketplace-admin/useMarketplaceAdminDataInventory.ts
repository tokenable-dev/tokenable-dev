"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminDataInventory, rq } from "@/lib/core";

export function useMarketplaceAdminDataInventory() {
  return useQuery({
    queryKey: rq.adminDataInventory(),
    queryFn: getAdminDataInventory,
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}
