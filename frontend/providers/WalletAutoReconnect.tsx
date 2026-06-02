"use client";

import { useEffect, useRef } from "react";
import { useReconnect } from "wagmi";
import { shouldAutoReconnectWalletOnMount } from "@/lib/wallet/walletEnvironment";

/**
 * Restores prior MetaMask extension sessions on desktop after mount.
 * Skipped on mobile so the MetaMask app is not opened before the user taps Connect.
 */
export function WalletAutoReconnect() {
  const { reconnectAsync } = useReconnect();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !shouldAutoReconnectWalletOnMount()) return;
    attempted.current = true;
    void reconnectAsync().catch(() => {
      // User can connect manually from header or page CTAs.
    });
  }, [reconnectAsync]);

  return null;
}
