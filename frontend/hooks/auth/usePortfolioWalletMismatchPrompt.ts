"use client";

import { useEffect, useRef } from "react";
import { useLinkedPortfolioWallet } from "./useLinkedPortfolioWallet";
import { useAuthUiStore } from "@/store/authUiStore";

/** On Portfolio, prompt to link when MetaMask switches to an unlinked address. */
export function usePortfolioWalletMismatchPrompt(enabled: boolean) {
  const wallet = useLinkedPortfolioWallet();
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const promptedForRef = useRef<string | null>(null);

  const { walletMismatch, connectedAddress, hasLinkedWallet } = wallet;

  useEffect(() => {
    if (!enabled) return;

    if (!hasLinkedWallet || !walletMismatch || !connectedAddress) {
      if (!walletMismatch) promptedForRef.current = null;
      return;
    }

    if (promptedForRef.current === connectedAddress) return;

    promptedForRef.current = connectedAddress;
    openWalletMismatch({ returnTo: "/portfolio" });
  }, [
    enabled,
    hasLinkedWallet,
    walletMismatch,
    connectedAddress,
    openWalletMismatch,
  ]);
}
