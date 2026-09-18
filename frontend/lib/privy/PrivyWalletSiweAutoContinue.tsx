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
 * WalletConnect (MetaMask). After eth_requestAccounts it shows
 * "Sign with your wallet" and waits for a second tap — another browser ↔ app trip.
 *
 * Goal: one MetaMask session. As soon as connect succeeds (often while MetaMask
 * is still open), auto-fire SIWE so the sign prompt lands in that same session.
 *
 * Strategy (while login intent is pending):
 * 1. Click Privy's "Sign with your wallet" CTA when it appears (uses Privy's
 *    own `loginWithWallet` path, including their MetaMask WC delay).
 * 2. Also call `wallet.loginOrLink()` when an external wallet is ready.
 * 3. Retry on an interval + tab focus — do NOT clear intent until authenticated.
 */
function findPrivySiweButton(): HTMLButtonElement | null {
  if (typeof document === "undefined") return null;
  for (const el of document.querySelectorAll("button")) {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!/^sign with your wallet$/i.test(text)) continue;
    if (el.disabled) continue;
    return el as HTMLButtonElement;
  }
  return null;
}

export function PrivyWalletSiweAutoContinue() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const inFlightRef = useRef(false);
  const lastClickAtRef = useRef(0);
  const lastLoginOrLinkAtRef = useRef(0);

  useEffect(() => {
    if (!authenticated) return;
    clearPrivyWalletLoginIntent();
    inFlightRef.current = false;
  }, [authenticated]);

  useEffect(() => {
    if (!ready || authenticated || !isMobileBrowserUa()) return;

    const tryContinue = () => {
      if (!hasPrivyWalletLoginIntent()) return;
      if (inFlightRef.current) return;

      const now = Date.now();

      // Prefer Privy's own Sign CTA — pushes personal_sign on the active WC session.
      const signBtn = findPrivySiweButton();
      if (signBtn && now - lastClickAtRef.current > 1_200) {
        lastClickAtRef.current = now;
        inFlightRef.current = true;
        try {
          signBtn.click();
        } finally {
          // Allow another attempt if SIWE was dismissed / timed out.
          window.setTimeout(() => {
            inFlightRef.current = false;
          }, 800);
        }
        return;
      }

      const wallet = wallets.find((w) => isPrivyExternalWallet(w));
      if (!wallet || typeof wallet.loginOrLink !== "function") return;
      if (now - lastLoginOrLinkAtRef.current < 2_500) return;

      lastLoginOrLinkAtRef.current = now;
      inFlightRef.current = true;
      void (async () => {
        try {
          await wallet.loginOrLink();
        } catch {
          /* user rejected / WC busy — keep intent for retry */
        } finally {
          inFlightRef.current = false;
        }
      })();
    };

    tryContinue();

    const intervalId = window.setInterval(tryContinue, 600);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      tryContinue();
    };
    const onPageShow = () => tryContinue();

    // Catch Privy modal mounting the Sign button after connect.
    const observer = new MutationObserver(() => tryContinue());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.clearInterval(intervalId);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [ready, authenticated, wallets]);

  return null;
}
