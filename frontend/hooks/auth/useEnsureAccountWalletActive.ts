"use client";

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useAccount } from "wagmi";
import {
  getPrimaryWalletAddress,
  normalizeWalletAddress,
} from "@/lib/auth/wallets";
import {
  findPrivyWalletByAddress,
  pickPrimaryPrivyWallet,
  pickPrivyUserEthereumWalletAddress,
  resolveAccountSigningWallet,
} from "@/lib/privy/wallet";
import { waitForWagmiAccountAddress } from "@/lib/privy/accountWalletReady";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/**
 * Keeps wagmi aligned with the Tokenable account primary wallet.
 * Waits until backend session sync sets primaryLinked — never guesses embedded early.
 */
export function useEnsureAccountWalletActive() {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const user = useAuthStore((s) => s.user);
  const { address: connectedAddress } = useAccount();
  const alignInFlight = useRef(false);
  const lastAlignedAddress = useRef<string | null>(null);
  const walletFingerprint = wallets.map((w) => w.address.toLowerCase()).join(",");
  const privyWalletHint = pickPrivyUserEthereumWalletAddress(privyUser) ?? "";

  useEffect(() => {
    if (!ready || !authenticated) return;

    const primaryLinked = getPrimaryWalletAddress(user);
    const pendingLinked =
      primaryLinked ??
      normalizeWalletAddress(pickPrimaryPrivyWallet(wallets)?.address) ??
      privyWalletHint;
    if (!pendingLinked) return;

    const connected = normalizeWalletAddress(connectedAddress);
    const primary = normalizeWalletAddress(pendingLinked);
    if (connected && primary && connected === primary) {
      lastAlignedAddress.current = primary;
      useAuthUiStore.getState().closeWalletMismatch();
      return;
    }

    const target =
      resolveAccountSigningWallet(wallets, primaryLinked ?? pendingLinked) ??
      findPrivyWalletByAddress(wallets, pendingLinked) ??
      pickPrimaryPrivyWallet(wallets);
    if (!target) return;

    const targetNorm = normalizeWalletAddress(target.address);
    if (!targetNorm) return;
    if (connected && connected === targetNorm) {
      lastAlignedAddress.current = targetNorm;
      return;
    }
    if (lastAlignedAddress.current === targetNorm && connected === targetNorm) return;

    if (alignInFlight.current) return;
    alignInFlight.current = true;
    void setActiveWallet(target)
      .then(async () => {
        await waitForWagmiAccountAddress(target.address);
        lastAlignedAddress.current = targetNorm;
        useAuthUiStore.getState().closeWalletMismatch();
      })
      .catch(() => {
        lastAlignedAddress.current = null;
      })
      .finally(() => {
        alignInFlight.current = false;
      });
  }, [
    ready,
    authenticated,
    user,
    connectedAddress,
    walletFingerprint,
    privyWalletHint,
    wallets,
    setActiveWallet,
  ]);
}
