"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import {
  getPrimaryWalletAddress,
  getUserLinkedWallets,
  isUserWalletLinked,
  normalizeWalletAddress,
  resolvePortfolioViewAddress,
  userHasLinkedWallet,
} from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";

/** Portfolio data is scoped to platform-linked wallets only. */
export function useLinkedPortfolioWallet() {
  const user = useAuthStore((s) => s.user);
  const { address: connectedAddress, isConnected } = useAccount();

  const linkedWallets = useMemo(() => getUserLinkedWallets(user), [user]);

  const linkedAddresses = useMemo(
    () =>
      linkedWallets
        .map((w) => normalizeWalletAddress(w.address))
        .filter((a): a is string => Boolean(a)),
    [linkedWallets],
  );

  const primaryAddress = useMemo(() => getPrimaryWalletAddress(user), [user]);

  const connectedNormalized = useMemo(
    () => normalizeWalletAddress(connectedAddress),
    [connectedAddress],
  );

  const connectedIsLinked = useMemo(
    () => isUserWalletLinked(user, connectedAddress),
    [user, connectedAddress],
  );

  const portfolioAddress = useMemo(
    () => resolvePortfolioViewAddress(user, connectedAddress),
    [user, connectedAddress],
  );

  const walletMismatch = Boolean(
    isConnected &&
      connectedNormalized &&
      !connectedIsLinked &&
      !primaryAddress,
  );

  return {
    linkedWallets,
    linkedAddresses,
    primaryAddress,
    connectedAddress: connectedNormalized,
    portfolioAddress,
    isConnected,
    hasLinkedWallet: userHasLinkedWallet(user),
    connectedIsLinked,
    walletMismatch,
    canSign: Boolean(isConnected && connectedIsLinked),
    /** True when portfolio rows match the wallet currently active in wagmi. */
    isViewingConnectedWallet: Boolean(
      portfolioAddress &&
        connectedNormalized &&
        portfolioAddress === connectedNormalized,
    ),
    /** @deprecated use connectedIsLinked */
    walletsMatch: Boolean(isConnected && connectedIsLinked),
    /** @deprecated use primaryAddress */
    linkedAddress: primaryAddress,
  };
}
