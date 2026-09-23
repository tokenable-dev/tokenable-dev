"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import {
  isTradeWalletSessionPending,
  resolveWalletSessionGate,
  shouldProactivelyOpenTradeWalletConnect,
} from "@/lib/auth/walletSessionGate";
import {
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
} from "@/lib/privy/wallet";
import {
  isWalletActivationInFlight,
  useAuthUiStore,
} from "@/store/authUiStore";
import { useAccessGate } from "./useAccessGate";
import { useAuthStore } from "@/store/authStore";

/** Level 1 gate: signed in, platform-linked wallet, and a matching wallet session. */
export function useTradeAccessGate(returnTo: string) {
  const user = useAuthStore((s) => s.user);
  const { canAccess, runAccessGate } = useAccessGate(1, returnTo);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const walletActivationPhase = useAuthUiStore((s) => s.walletActivationPhase);
  const { ready: privyReady, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();

  const connection = useMemo(
    () => ({ address, isConnected, isConnecting, isReconnecting }),
    [address, isConnected, isConnecting, isReconnecting],
  );

  const sessionGate = useMemo(
    () => resolveWalletSessionGate(user, connection),
    [user, connection],
  );

  const walletActivationInFlight = isWalletActivationInFlight(
    walletActivationPhase,
  );

  const walletSessionPending = useMemo(
    () => isTradeWalletSessionPending(connection, walletActivationInFlight),
    [connection, walletActivationInFlight],
  );

  const silentEmbeddedActivation = useMemo(() => {
    const primary = getPrimaryWalletAddress(user);
    if (!primary) return false;
    const wallet = findPrivyWalletByAddress(wallets, primary);
    return Boolean(wallet && isPrivyEmbeddedWallet(wallet));
  }, [user, wallets]);

  const proactiveConnectAttempted = useRef(false);

  useEffect(() => {
    if (!privyReady || !authenticated) return;
    if (sessionGate.action === "allow") {
      proactiveConnectAttempted.current = false;
      return;
    }
    if (walletActivationPhase === "failed") return;

    const shouldOpen = shouldProactivelyOpenTradeWalletConnect({
      canAccess,
      sessionAction: sessionGate.action,
      connection,
      walletActivationInFlight,
      silentEmbeddedActivation,
    });
    if (!shouldOpen || proactiveConnectAttempted.current) return;

    proactiveConnectAttempted.current = true;
    openConnectWallet({ returnTo });
  }, [
    privyReady,
    authenticated,
    canAccess,
    sessionGate.action,
    connection,
    walletActivationInFlight,
    silentEmbeddedActivation,
    walletActivationPhase,
    openConnectWallet,
    returnTo,
  ]);

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

  return {
    canTrade,
    canAccess,
    walletSessionPending,
    runTradeAccessGate,
  };
}
