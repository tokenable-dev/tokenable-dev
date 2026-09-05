"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCustodyNfts, rq } from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

export function useMarketplaceAdminCustodyNfts() {
  const { chainId } = useAppChain();
  return useQuery({
    queryKey: rq.adminCustodyNfts(chainId),
    queryFn: () => getAdminCustodyNfts(),
    staleTime: 15_000,
  });
}
