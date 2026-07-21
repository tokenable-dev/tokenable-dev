"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccessGate } from "./useAccessGate";

export function useSellAccessGate(returnTo = "/vault") {
  const router = useRouter();
  // Level 1: Markets buy/bid/list need wallet only. KYC is gated at vault ship / redeem.
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);

  const navigateToVault = useCallback(() => {
    runAccessGate(() => router.push("/vault"));
  }, [runAccessGate, router]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToVault,
  };
}
