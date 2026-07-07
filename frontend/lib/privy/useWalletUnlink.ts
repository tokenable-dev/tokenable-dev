"use client";

import { useCallback } from "react";
import { usePrivy, useUnlinkWallet, useWallets } from "@privy-io/react-auth";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import {
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
} from "@/lib/privy/wallet";
import { useAuthStore } from "@/store/authStore";

const EMBEDDED_UNLINK_MSG =
  "Embedded wallets stay with your Privy account. Only external wallets (e.g. MetaMask) can be unlinked.";

/** Unlink an external Privy wallet and refresh the Tokenable session. */
export function usePrivyWalletUnlink() {
  const { unlink: privyUnlink } = useUnlinkWallet();
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const setUser = useAuthStore((s) => s.setUser);
  const refresh = useAuthStore((s) => s.refresh);

  const canUnlink = useCallback(
    (address: string): boolean => {
      const match = findPrivyWalletByAddress(wallets, address);
      return Boolean(match && !isPrivyEmbeddedWallet(match));
    },
    [wallets],
  );

  const unlink = useCallback(
    async (address: string): Promise<void> => {
      const match = findPrivyWalletByAddress(wallets, address);
      if (!match) {
        throw new Error("Wallet not found in your Privy session.");
      }
      if (isPrivyEmbeddedWallet(match)) {
        throw new Error(EMBEDDED_UNLINK_MSG);
      }

      await privyUnlink({ address });
      const updated = await refreshPrivyAuthSession(getAccessToken);
      if (updated) {
        setUser(updated);
        return;
      }
      await refresh();
    },
    [wallets, privyUnlink, getAccessToken, setUser, refresh],
  );

  return { unlink, canUnlink, embeddedUnlinkMessage: EMBEDDED_UNLINK_MSG };
}
