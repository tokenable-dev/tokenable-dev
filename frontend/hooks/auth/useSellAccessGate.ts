"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { canAccessVault } from "@/lib/auth/accountAccess";
import { useAuthStore } from "@/store/authStore";
import { useAccessGate } from "./useAccessGate";

export function useSellAccessGate(returnTo = "/vault") {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { canAccess, runAccessGate } = useAccessGate(2, returnTo);

  const navigateToVault = useCallback(() => {
    if (!canAccessVault(user)) return;
    runAccessGate(() => router.push("/vault"));
  }, [user, runAccessGate, router]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToVault,
  };
}
