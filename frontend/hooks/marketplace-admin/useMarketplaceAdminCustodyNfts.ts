"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCustodyNfts, rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";

export function useMarketplaceAdminCustodyNfts() {
  const chainId = activeRqChainId();
  return useQuery({
    queryKey: rq.adminCustodyNfts(chainId),
    queryFn: () => getAdminCustodyNfts(),
    staleTime: 15_000,
  });
}
