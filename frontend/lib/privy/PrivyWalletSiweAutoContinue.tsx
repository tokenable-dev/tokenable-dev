"use client";

import { useEffect, useRef } from "react";
import {
  useConnectWallet,
  usePrivy,
  useWallets,
  type ConnectedWallet,
} from "@privy-io/react-auth";
import { isPrivyExternalWallet } from "@/lib/privy/wallet";
import {
  clearMetamaskConnectFlow,
  clearPrivyWalletLoginIntent,
  hasMetamaskConnectFlow,
  isMobileBrowserUa,
  markMetamaskConnectFlow,
  sleep,
} from "@/lib/privy/walletLoginIntent";

/**
 * Single MetaMask visit on mobile (connect + SIWE).
 *
 * Privy WC sets `separateConnectAndSign`, so a manual Sign tap after returning
 * to the browser causes a second MetaMask deeplink.
 *
 * We only run after the user taps **MetaMask** in the Privy UI:
 * 1. Mark `tk_privy_mm_connect_flow`
 * 2. On `useConnectWallet` onSuccess (and/or Sign CTA), push SIWE quickly while
 *    MetaMask is often still open → `personal_sign` on the same WC session
 *
 * Cold page entry never calls `loginOrLink` — no MetaMask without that tap.
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

function isMetamaskUiTarget(el: Element): boolean {
  const text = (el.textContent ?? "").toLowerCase();
  const aria = (el.getAttribute("aria-label") ?? "").toLowerCase();
  const title = (el.getAttribute("title") ?? "").toLowerCase();
  return (
    text.includes("metamask") ||
    aria.includes("metamask") ||
    title.includes("metamask")
  );
}

export function PrivyWalletSiweAutoContinue() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const siweInFlight = useRef(false);
  const siweDoneForAddr = useRef<string | null>(null);

  // Drop stale flags from a previous visit.
  useEffect(() => {
    clearPrivyWalletLoginIntent();
    clearMetamaskConnectFlow();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    clearPrivyWalletLoginIntent();
    clearMetamaskConnectFlow();
    siweInFlight.current = false;
    siweDoneForAddr.current = null;
  }, [authenticated]);

  // User must tap MetaMask in Privy before we ever push SIWE / deeplink.
  useEffect(() => {
    if (!isMobileBrowserUa()) return;
    const onPointer = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const hit = t.closest("button, a, [role='button'], div[class*='wallet']");
      if (!hit || !isMetamaskUiTarget(hit)) return;
      markMetamaskConnectFlow();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("click", onPointer, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("click", onPointer, true);
    };
  }, []);

  const runSiwe = async (wallet?: ConnectedWallet | null) => {
    if (!isMobileBrowserUa()) return;
    if (!hasMetamaskConnectFlow()) return;
    if (siweInFlight.current) return;

    const addr = wallet?.address?.toLowerCase() ?? null;
    if (addr && siweDoneForAddr.current === addr) return;

    siweInFlight.current = true;
    try {
      // Keep this short while MetaMask is still open (tab often `hidden`).
      // Privy desktop WC waits ~2.5s; we use less so SIWE lands before the user leaves.
      await sleep(document.hidden ? 900 : 500);

      if (!hasMetamaskConnectFlow()) return;

      const signBtn = findPrivySiweButton();
      if (signBtn) {
        signBtn.click();
        if (addr) siweDoneForAddr.current = addr;
        return;
      }

      const target =
        wallet ??
        wallets.find((w) => isPrivyExternalWallet(w)) ??
        null;
      if (target && typeof target.loginOrLink === "function") {
        await target.loginOrLink();
        siweDoneForAddr.current = target.address.toLowerCase();
      }
    } catch {
      siweDoneForAddr.current = null;
    } finally {
      siweInFlight.current = false;
    }
  };

  // Fires when a wallet finishes connecting — including Privy login → MetaMask WC.
  useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (authenticated) return;
      if (!hasMetamaskConnectFlow()) return;
      void runSiwe(wallet as ConnectedWallet);
    },
  });

  // Backup: Sign CTA mounted / wallet listed while MetaMask flow is active.
  useEffect(() => {
    if (!ready || authenticated || !isMobileBrowserUa()) return;

    const tryContinue = () => {
      if (!hasMetamaskConnectFlow()) return;
      if (findPrivySiweButton()) {
        void runSiwe(null);
        return;
      }
      const external = wallets.find((w) => isPrivyExternalWallet(w));
      if (external) void runSiwe(external);
    };

    tryContinue();
    const id = window.setInterval(tryContinue, 400);
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!hasMetamaskConnectFlow()) return;
      void runSiwe(null);
    };
    const observer = new MutationObserver(() => tryContinue());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runSiwe closes over latest wallets
  }, [ready, authenticated, wallets]);

  return null;
}
