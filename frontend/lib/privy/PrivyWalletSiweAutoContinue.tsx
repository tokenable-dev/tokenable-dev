"use client";

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { isPrivyExternalWallet } from "@/lib/privy/wallet";
import {
  clearPrivyWalletLoginIntent,
  hasPrivyWalletLoginIntent,
  isMobileBrowserUa,
} from "@/lib/privy/walletLoginIntent";

/**
 * Privy's ConnectionStatusScreen sets `separateConnectAndSign` on mobile for
 * WalletConnect (MetaMask). After eth_requestAccounts succeeds it shows
 * "Sign with your wallet" and waits for a second tap — forcing another
 * browser ↔ MetaMask round trip.
 *
 * When a login intent is pending, fire `loginOrLink()` as soon as the external
 * wallet appears in `useWallets` (often while MetaMask is still open on the WC
 * session) so SIWE can land in the same MetaMask session. Retry on tab focus
 * if the first attempt needs a gesture.
 */
export function PrivyWalletSiweAutoContinue() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const inFlightRef = useRef(false);
  const attemptedAddrRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    clearPrivyWalletLoginIntent();
    attemptedAddrRef.current = null;
    inFlightRef.current = false;
  }, [authenticated]);

  useEffect(() => {
    if (!ready || authenticated || !isMobileBrowserUa()) return;

    const trySiwe = (opts?: { forceRetry?: boolean }) => {
      if (!hasPrivyWalletLoginIntent()) return;
      if (inFlightRef.current) return;

      const wallet = wallets.find((w) => isPrivyExternalWallet(w));
      if (!wallet || typeof wallet.loginOrLink !== "function") return;

      const addr = wallet.address.toLowerCase();
      if (!opts?.forceRetry && attemptedAddrRef.current === addr) return;

      attemptedAddrRef.current = addr;
      inFlightRef.current = true;

      void (async () => {
        try {
          await wallet.loginOrLink();
          clearPrivyWalletLoginIntent();
        } catch {
          attemptedAddrRef.current = null;
        } finally {
          inFlightRef.current = false;
        }
      })();
    };

    trySiwe();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      trySiwe({ forceRetry: true });
    };
    const onPageShow = () => trySiwe({ forceRetry: true });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [ready, authenticated, wallets]);

  return null;
}
