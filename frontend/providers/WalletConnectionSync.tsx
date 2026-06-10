"use client";

import { useEffect, useRef } from "react";
import { useAccount, useReconnect } from "wagmi";
import { shouldAutoReconnectWalletOnMount } from "@/lib/wallet/walletEnvironment";

type EthereumProvider = {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

/**
 * Safety net: if MetaMask still has accounts but wagmi fell back to
 * disconnected (e.g. reconnect raced on HMR or mobile refresh), try reconnect again.
 */
export function WalletConnectionSync() {
  const { status } = useAccount();
  const { reconnectAsync } = useReconnect();
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!shouldAutoReconnectWalletOnMount()) return;

    let syncing = false;

    async function tryReconnect() {
      if (statusRef.current !== "disconnected" || syncing) return;
      syncing = true;
      try {
        await reconnectAsync();
      } catch {
        // User can connect manually from header or page CTAs.
      } finally {
        syncing = false;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void tryReconnect();
    }

    function onAccountsChanged(accounts: unknown) {
      if (!Array.isArray(accounts) || accounts.length === 0) return;
      void tryReconnect();
    }

    document.addEventListener("visibilitychange", onVisibility);
    const eth = (typeof window !== "undefined" ? window.ethereum : undefined) as
      | EthereumProvider
      | undefined;
    eth?.on?.("accountsChanged", onAccountsChanged);

    // Mobile refresh: wagmi may finish hydrating after the first paint.
    const mountTimer = window.setTimeout(() => void tryReconnect(), 0);

    return () => {
      window.clearTimeout(mountTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      eth?.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [reconnectAsync]);

  return null;
}
