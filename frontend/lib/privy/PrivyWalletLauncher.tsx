"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { findPrivyWalletByAddress, resolveActivePrivyWallet } from "@/lib/privy/wallet";
import { getPrimaryWalletAddress } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

async function waitForAccountPrivyWallet(
  readWallets: () => ConnectedWallet[],
  primaryLinked: string,
  timeoutMs = 8000,
): Promise<ConnectedWallet | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = findPrivyWalletByAddress(readWallets(), primaryLinked);
    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return findPrivyWalletByAddress(readWallets(), primaryLinked);
}

/**
 * Activates the account's primary wallet in wagmi when the auth UI requests it.
 * Wallet linking (post-login) is handled natively by Privy UserPill / linkWallet()
 * and does NOT go through this component.
 */
export function PrivyWalletLauncher() {
  const router = useRouter();
  const connectWalletOpen = useAuthUiStore((s) => s.connectWalletOpen);
  const closeConnectWallet = useAuthUiStore((s) => s.closeConnectWallet);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const user = useAuthStore((s) => s.user);
  const { ready, authenticated, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const launchInFlight = useRef(false);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;

  useEffect(() => {
    if (!connectWalletOpen || !ready || !authenticated || launchInFlight.current) {
      return;
    }

    launchInFlight.current = true;
    closeConnectWallet();

    void (async () => {
      try {
        const primaryLinked = getPrimaryWalletAddress(user);

        if (primaryLinked) {
          const matchingPrivyWallet =
            findPrivyWalletByAddress(walletsRef.current, primaryLinked) ??
            (await waitForAccountPrivyWallet(() => walletsRef.current, primaryLinked));

          if (matchingPrivyWallet) {
            await setActiveWallet(matchingPrivyWallet);
            const returnTo = consumeReturnTo();
            if (returnTo) router.push(returnTo);
            return;
          }
          // Account wallet not in this browser session — do not auto-open linkWallet.
          return;
        }

        await linkWallet();
        const activeWallet = resolveActivePrivyWallet(
          walletsRef.current,
          primaryLinked ?? undefined,
        );
        if (activeWallet) {
          await setActiveWallet(activeWallet);
        }

        const returnTo = consumeReturnTo();
        if (returnTo) router.push(returnTo);
      } catch {
        // User dismissed Privy modal — pendingReturnTo stays for a later attempt.
      } finally {
        launchInFlight.current = false;
      }
    })();
  }, [
    connectWalletOpen,
    ready,
    authenticated,
    linkWallet,
    user,
    setActiveWallet,
    closeConnectWallet,
    consumeReturnTo,
    router,
  ]);

  return null;
}
