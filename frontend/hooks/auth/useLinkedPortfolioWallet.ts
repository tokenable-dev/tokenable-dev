"use client";

import { useMemo } from "react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";
import {
  getPrimaryWalletAddress,
  getUserLinkedWallets,
  isUserWalletLinked,
  normalizeWalletAddress,
  userHasLinkedWallet,
} from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";

/** Portfolio uses connected wallet when linked; otherwise primary linked wallet. */
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

  const portfolioAddress = useMemo(() => {
    if (connectedIsLinked && connectedNormalized) return connectedNormalized;
    return primaryAddress;
  }, [connectedIsLinked, connectedNormalized, primaryAddress]);

  return {
    linkedWallets,
    linkedAddresses,
    primaryAddress,
    connectedAddress: connectedNormalized,
    portfolioAddress,
    isConnected,
    hasLinkedWallet: userHasLinkedWallet(user),
    connectedIsLinked,
    canSign: Boolean(isConnected && connectedIsLinked),
    walletMismatch: Boolean(
      isConnected && connectedNormalized && !connectedIsLinked,
    ),
    /** @deprecated use connectedIsLinked */
    walletsMatch: Boolean(isConnected && connectedIsLinked),
    /** @deprecated use primaryAddress */
    linkedAddress: primaryAddress,
  };
}
