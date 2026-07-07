"use client";

import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { alignWagmiToAccountWallet } from "@/lib/privy/accountWalletReady";
import { useAuthStore } from "@/store/authStore";

/** Ensures wagmi uses the Privy account wallet (never a browser extension). */
export function useEnsureAccountWalletReady() {
  const user = useAuthStore((s) => s.user);
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  return useCallback(async (): Promise<string> => {
    const primary = getPrimaryWalletAddress(user);
    if (!primary) {
      throw new Error("Link your account wallet before continuing.");
    }
    return alignWagmiToAccountWallet({
      wallets,
      accountPrimary: primary,
      setActiveWallet,
    });
  }, [user, wallets, setActiveWallet]);
}
