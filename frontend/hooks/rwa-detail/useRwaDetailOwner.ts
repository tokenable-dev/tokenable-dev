"use client";

import { useReadContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_READ_ABI,
} from "@/constants/contracts";

export function useRwaDetailOwner(
  tokenId: number,
  tokenIdOk: boolean,
  viewerAddress: string | undefined,
) {
  const {
    data: ownerOnChain,
    isLoading: ownerLoading,
    isError: ownerError,
  } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_READ_ABI,
    functionName: "ownerOf",
    args: [BigInt(Math.max(0, Math.floor(tokenId)))],
    chainId: sepolia.id,
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
  const isOwner = Boolean(
    viewerAddress && ownerAddr && viewerAddress.toLowerCase() === ownerAddr,
  );

  return {
    ownerOnChain,
    ownerLoading,
    ownerError,
    isOwner,
  };
}
