"use client";

import { useMemo } from "react";
import { useBalance } from "wagmi";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import {
  formatHeaderKycLabel,
  formatNativeBalanceLabel,
  shortenWalletAddress,
} from "@/lib/wallet/walletMenuDisplay";
import { useAuthStore } from "@/store/authStore";

export function useHeaderWalletMenuData() {
  const user = useAuthStore((s) => s.user);
  const { primaryAddress } = useAccountWalletSession();

  const displayAddress = useMemo(
    () => shortenWalletAddress(primaryAddress ?? user?.walletAddress),
    [primaryAddress, user?.walletAddress],
  );

  const kyc = useMemo(() => formatHeaderKycLabel(user), [user]);

  const { data: nativeBalance } = useBalance({
    address: primaryAddress as `0x${string}` | undefined,
    query: { enabled: Boolean(primaryAddress) },
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
  };
}
