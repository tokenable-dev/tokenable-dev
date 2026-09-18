"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  clearPrivyWalletLoginIntent,
  isMobileBrowserUa,
} from "@/lib/privy/walletLoginIntent";

/**
 * Mobile MetaMask (WalletConnect) SIWE helper — Sign CTA only.
 *
 * Privy sets `separateConnectAndSign` on mobile WC: after the user explicitly
 * connects MetaMask in the Privy modal, it shows "Sign with your wallet" and
 * waits for a tap (second round-trip). We auto-click that CTA only.
 *
 * Hard rule: never call `loginOrLink()` / never deeplink MetaMask unless Privy
 * is already showing the post-connect Sign button. A leftover session intent +
 * a previously connected wallet must not open MetaMask on cold page entry.
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
  const clickedRef = useRef(false);
  const scheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop any stale SIWE intent from a previous visit — it must not survive into
  // a cold load and trigger wallet prompts without a Privy MetaMask click.
  useEffect(() => {
    clearPrivyWalletLoginIntent();
  }, []);

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

    const fireSignClick = () => {
      if (clickedRef.current) return;
      const signBtn = findPrivySiweButton();
      if (!signBtn) return;

      clickedRef.current = true;
      clearScheduled();
      signBtn.click();

      // Allow one retry if the user dismissed SIWE / WC was not ready.
      window.setTimeout(() => {
        clickedRef.current = false;
      }, 4_000);
    };

    const armIfSignVisible = () => {
      if (clickedRef.current) return;
      if (!findPrivySiweButton()) return;
      if (scheduledRef.current) return;

      // Only runs when Privy already showed Sign — i.e. user clicked MetaMask
      // in Privy and connect succeeded. Hidden tab ≈ still in MetaMask.
      const delay = document.hidden ? 1_800 : 350;
      scheduledRef.current = setTimeout(() => {
        scheduledRef.current = null;
        fireSignClick();
      }, delay);
    };

    armIfSignVisible();

    const intervalId = window.setInterval(armIfSignVisible, 400);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      clearScheduled();
      // Only if Sign CTA is on screen (active Privy connect flow).
      if (findPrivySiweButton()) fireSignClick();
    };
    const observer = new MutationObserver(() => armIfSignVisible());
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
  }, [ready, authenticated]);

  return null;
}
