"use client";

import { useMemo } from "react";
import { getChainContracts } from "@/lib/chains";
import { useAppChain } from "@/providers/AppChainProvider";

export function useChainContracts() {
  const { chainId } = useAppChain();
  return useMemo(() => getChainContracts(chainId), [chainId]);
}
