"use client";

import { useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
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
    try {
      return await alignWagmiToAccountWallet({
        wallets,
        accountPrimary: primary,
        setActiveWallet,
        chainId,
      });
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (/wrong network|chain/i.test(text)) {
        trackEvent("wallet_chain_mismatch", {
          error_code: "CHAIN_MISMATCH",
          chain_id: chainId,
        });
      }
      throw err;
    }
  }, [user, wallets, setActiveWallet, chainId]);
}
