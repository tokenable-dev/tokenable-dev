"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCustodyNfts, rq } from "@/lib/core";

export function useMarketplaceAdminCustodyNfts() {
  return useQuery({
    queryKey: rq.adminCustodyNfts(),
    queryFn: () => getAdminCustodyNfts(),
    staleTime: 15_000,
  });
}
