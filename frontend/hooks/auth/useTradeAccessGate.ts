"use client";

import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { resolveWalletSessionGate } from "@/lib/auth/walletSessionGate";
import { useAccessGate } from "./useAccessGate";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/** Level 1 gate: signed in, platform-linked wallet, and a matching wallet session. */
export function useTradeAccessGate(returnTo: string) {
  const user = useAuthStore((s) => s.user);
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  const connection = useMemo(
    () => ({ address, isConnected, isConnecting, isReconnecting }),
    [address, isConnected, isConnecting, isReconnecting],
  );

  const sessionGate = useMemo(
    () => resolveWalletSessionGate(user, connection),
    [user, connection],
  );

  const canTrade = useMemo(
    () => canAccess && sessionGate.action === "allow",
    [canAccess, sessionGate.action],
  );

  const runTradeAccessGate = useCallback(
    (onAllowed?: () => void): boolean => {
      if (!runAccessGate()) return false;

      switch (sessionGate.action) {
        case "connect-wallet":
          openConnectWallet({ returnTo });
          return false;
        case "wallet-mismatch":
          openWalletMismatch({ returnTo });
          return false;
        case "allow":
          onAllowed?.();
          return true;
      }
    },
    [
      runAccessGate,
      sessionGate.action,
      openConnectWallet,
      openWalletMismatch,
      returnTo,
    ],
  );

  return { canTrade, runTradeAccessGate };
}
