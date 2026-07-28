"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccessGate } from "./useAccessGate";

/** Sell entry — always via `/sell` router (design system-2 Sell.html). */
export function useSellAccessGate(returnTo = "/sell") {
  const router = useRouter();
  // Level 1: Markets buy/bid/list need wallet only. KYC is gated at vault ship / redeem.
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);

  const navigateToSell = useCallback(() => {
    runAccessGate(() => router.push("/sell"));
  }, [runAccessGate, router]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToSell,
  };
}
