"use client";

import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { alignWagmiToAccountWallet } from "@/lib/privy/accountWalletReady";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";

/** Ensures wagmi uses the Privy account wallet on the app-selected chain. */
export function useEnsureAccountWalletReady() {
  const user = useAuthStore((s) => s.user);
  const { chainId } = useAppChain();
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
      chainId,
    });
  }, [user, wallets, setActiveWallet, chainId]);
}
