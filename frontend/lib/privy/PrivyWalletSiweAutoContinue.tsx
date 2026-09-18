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
 * Why MetaMask opens twice on mobile
 * ----------------------------------
 * Privy's ConnectionStatusScreen sets `separateConnectAndSign` for mobile
 * WalletConnect (MetaMask). After eth_requestAccounts it shows
 * "Sign with your wallet" and does NOT auto-call `loginWithWallet` (desktop
 * MetaMask WC waits ~2.5s then auto-prompts SIWE). The Sign tap usually
 * happens after the user is already back in the browser → a second deeplink.
 *
 * Fix: the moment connect succeeds (Sign CTA mounts — often while MetaMask is
 * still open and this tab is `document.hidden`), wait briefly for WC to settle
 * (same idea as Privy's 2.5s desktop delay), then click Sign / `loginOrLink`
 * so `personal_sign` is pushed over the existing WC session. MetaMask can show
 * the SIWE prompt in the same app visit; the user returns once, already logged in.
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
  const clickedRef = useRef(false);
  const scheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loginOrLinkAtRef = useRef(0);

  useEffect(() => {
    if (!authenticated) return;
    clearPrivyWalletLoginIntent();
    clickedRef.current = false;
    if (scheduledRef.current) {
      clearTimeout(scheduledRef.current);
      scheduledRef.current = null;
    }
  }, [authenticated]);

  useEffect(() => {
    if (!ready || authenticated || !isMobileBrowserUa()) return;

    const clearScheduled = () => {
      if (scheduledRef.current) {
        clearTimeout(scheduledRef.current);
        scheduledRef.current = null;
      }
    };

    const fireSign = () => {
      if (!hasPrivyWalletLoginIntent() || clickedRef.current) return;

      const signBtn = findPrivySiweButton();
      if (signBtn) {
        clickedRef.current = true;
        clearScheduled();
        signBtn.click();
        // One retry window if SIWE was dismissed / WC not ready.
        window.setTimeout(() => {
          if (!hasPrivyWalletLoginIntent()) return;
          clickedRef.current = false;
        }, 4_000);
        return;
      }

      const wallet = wallets.find((w) => isPrivyExternalWallet(w));
      if (!wallet || typeof wallet.loginOrLink !== "function") return;
      const now = Date.now();
      if (now - loginOrLinkAtRef.current < 3_000) return;
      loginOrLinkAtRef.current = now;
      clickedRef.current = true;
      void (async () => {
        try {
          await wallet.loginOrLink();
        } catch {
          clickedRef.current = false;
        }
      })();
    };

    /** Prefer firing while MetaMask is still open (tab hidden). */
    const armSign = () => {
      if (!hasPrivyWalletLoginIntent() || clickedRef.current) return;

      const hasCta = Boolean(findPrivySiweButton());
      const hasWallet = wallets.some((w) => isPrivyExternalWallet(w));
      if (!hasCta && !hasWallet) return;
      if (scheduledRef.current) return;

      // Hidden = still in MetaMask → settle WC then push personal_sign in-app.
      // Visible = already returned → fire ASAP (may still need a second deep link).
      const delay = document.hidden ? 1_800 : 350;
      scheduledRef.current = setTimeout(() => {
        scheduledRef.current = null;
        fireSign();
      }, delay);
    };

    armSign();

    const intervalId = window.setInterval(armSign, 250);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      clearScheduled();
      fireSign();
    };
    const observer = new MutationObserver(() => armSign());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      clearScheduled();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
    };
  }, [ready, authenticated, wallets]);

  return null;
}
