"use client";

import { useReadContract } from "wagmi";
import { TOKENABLE_RWA_READ_ABI } from "@/constants/contracts";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";

export function useRwaDetailOwner(
  tokenId: number,
  tokenIdOk: boolean,
  viewerAddress: string | undefined,
) {
  const { chainId } = useAppChain();
  const { rwaAddress } = useChainContracts();

  const {
    data: ownerOnChain,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useReadContract({
    address: rwaAddress,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId,
    query: {
      enabled: tokenIdOk,
      retry: 2,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: false,
    },
  });

  const ownerAddr =
    typeof ownerOnChain === "string" ? ownerOnChain.toLowerCase() : "";

  const isOwner =
    Boolean(viewerAddress) &&
    ownerAddr.length > 0 &&
    ownerAddr === viewerAddress!.toLowerCase();

  return {
    ownerOnChain,
    ownerAddr,
    isOwner,
    ownerLoading,
    ownerError,
  };
}
