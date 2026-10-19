"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { useAccessGate } from "./useAccessGate";

/** Sell entry — no wallet opens Privy connect; a linked wallet opens the sell hub. */
export function useSellAccessGate(returnTo = "/sell") {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);

  const navigateToSell = useCallback(() => {
    if (!user) {
      openSignIn({ returnTo: "/vault" });
      return;
    }
    if (!userHasLinkedWallet(user)) {
      openConnectWallet({ returnTo: "/vault" });
      return;
    }
    router.push("/vault");
  }, [openConnectWallet, openSignIn, router, user]);

  return {
    canSell: canAccess,
    runSellAccessGate: runAccessGate,
    navigateToSell,
  };
}
