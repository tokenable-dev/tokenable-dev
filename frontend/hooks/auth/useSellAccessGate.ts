"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccessGate } from "./useAccessGate";

/** Sell entry — guests see the sell landing (`/vault`); signed-in users route via `/sell`. */
export function useSellAccessGate(returnTo = "/sell") {
  const router = useRouter();
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);

  const navigateToSell = useCallback(() => {
    router.push("/vault");
  }, [router]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToSell,
  };
}
