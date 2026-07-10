"use client";

import { useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useBalance } from "wagmi";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { pickPrimaryPrivyWallet } from "@/lib/privy/wallet";
import {
  formatHeaderKycLabel,
  formatNativeBalanceLabel,
  shortenWalletAddress,
} from "@/lib/wallet/walletMenuDisplay";
import { useAuthStore } from "@/store/authStore";

export function useHeaderWalletMenuData() {
  const user = useAuthStore((s) => s.user);
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { primaryAddress } = useAccountWalletSession();

  // First social login: Privy client has the embedded wallet before Tokenable session
  // catches up — show that address/balance immediately instead of "—".
  const pendingPrivyAddress = useMemo(() => {
    if (primaryAddress || user?.walletAddress) return undefined;
    if (!authenticated) return undefined;
    return normalizeWalletAddress(pickPrimaryPrivyWallet(wallets)?.address);
  }, [primaryAddress, user?.walletAddress, authenticated, wallets]);

  const resolvedAddress = primaryAddress ?? user?.walletAddress ?? pendingPrivyAddress;

  const displayAddress = useMemo(
    () => shortenWalletAddress(resolvedAddress),
    [resolvedAddress],
  );

  const kyc = useMemo(() => formatHeaderKycLabel(user), [user]);

  const { data: nativeBalance, refetch: refetchBalance } = useBalance({
    address: resolvedAddress as `0x${string}` | undefined,
    query: { enabled: Boolean(resolvedAddress) },
  });

  const balanceLabel = useMemo(
    () => formatNativeBalanceLabel(nativeBalance?.value, nativeBalance?.symbol ?? "ETH"),
    [nativeBalance?.value, nativeBalance?.symbol],
  );

  return {
    user,
    displayAddress,
    kyc,
    balanceLabel,
    refetchBalance,
  };
}
