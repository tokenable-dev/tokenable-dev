"use client";

import { useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import {
  getPrimaryWalletAddress,
  normalizeWalletAddress,
  userHasLinkedWallet,
} from "@/lib/auth/wallets";
import { isEmbeddedOnlyWalletPolicy } from "@/lib/privy/config";
import {
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
  resolveAccountSigningWallet,
} from "@/lib/privy/wallet";
import {
  isWalletSessionActive,
  isWalletSessionPending,
} from "@/lib/wallet/walletConnectionDisplay";
import { useAuthStore } from "@/store/authStore";

/**
 * Tokenable account wallet session — Privy embedded primary, not browser extensions.
 * After refresh wagmi may lag behind Privy; treat "activating" separately from disconnected.
 */
export function useAccountWalletSession() {
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const { ready: privyReady, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  const primaryAddress = useMemo(() => getPrimaryWalletAddress(user), [user]);
  const connectedNormalized = useMemo(
    () => normalizeWalletAddress(address),
    [address],
  );
  const connectedMatchesPrimary = useMemo(
    () =>
      Boolean(
        primaryAddress &&
          connectedNormalized &&
          connectedNormalized === primaryAddress,
      ),
    [primaryAddress, connectedNormalized],
  );
  const activePrivyWallet = useMemo(
    () =>
      connectedNormalized
        ? findPrivyWalletByAddress(wallets, connectedNormalized)
        : undefined,
    [wallets, connectedNormalized],
  );
  const connectedIsEmbeddedAccountWallet = useMemo(
    () =>
      connectedMatchesPrimary &&
      (!isEmbeddedOnlyWalletPolicy() || isPrivyEmbeddedWallet(activePrivyWallet)),
    [connectedMatchesPrimary, activePrivyWallet],
  );
  const privyHasAccountWallet = useMemo(
    () => Boolean(resolveAccountSigningWallet(wallets, primaryAddress)),
    [wallets, primaryAddress],
  );

  const wagmiSessionActive = isWalletSessionActive({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });
  const wagmiSessionPending = isWalletSessionPending({
    address,
    isConnected,
    isConnecting,
    isReconnecting,
  });

  const hasAccountWallet = userHasLinkedWallet(user);

  const isWalletReady = Boolean(
    primaryAddress && wagmiSessionActive && connectedIsEmbeddedAccountWallet,
  );

  const isWalletActivating = Boolean(
    authInitialized &&
      authenticated &&
      privyReady &&
      primaryAddress &&
      !isWalletReady &&
      (privyHasAccountWallet || wagmiSessionPending),
  );

  return {
    primaryAddress,
    sessionAddress: primaryAddress,
    hasAccountWallet,
    isWalletReady,
    isWalletActivating,
    connectedIsEmbeddedAccountWallet,
    wagmiSessionActive,
  };
}
