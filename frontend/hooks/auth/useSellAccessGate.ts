"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccessGate } from "./useAccessGate";

export function useSellAccessGate(returnTo = "/vault") {
  const router = useRouter();
  const { canAccess, runAccessGate } = useAccessGate(2, returnTo);

  const navigateToVault = useCallback(() => {
    runAccessGate(() => router.push("/vault"));
  }, [runAccessGate, router]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToVault,
  };
}
