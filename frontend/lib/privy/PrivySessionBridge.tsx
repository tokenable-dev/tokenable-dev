"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLogout, usePrivy, useWallets } from "@privy-io/react-auth";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import {
  isSignOutInProgress,
  registerPrivySignOut,
  syncPrivySession,
} from "@/lib/privy/session";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

const PRIVY_WALLET_CATCHUP_MS = 400;
const PRIVY_WALLET_CATCHUP_ATTEMPTS = 5;

/**
 * Keeps Tokenable session in sync with Privy auth.
 * Wagmi wallet alignment runs in AccountWalletAligner only (avoids duplicate setActiveWallet).
 *
 * First social login: Privy creates an embedded wallet after auth. That wallet list change
 * remounts this effect while the initial POST /auth/privy/session is in flight. We must
 * still drain `syncPending` after cancel, and keep retrying while the client has wallets
 * but the Tokenable user record does not yet (Privy API lag).
 */
export function PrivySessionBridge() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      void useAuthStore.getState().logout();
    },
  });
  const { wallets } = useWallets();
  const setUser = useAuthStore((s) => s.setUser);
  const syncInFlight = useRef(false);
  const syncPending = useRef(false);
  const returnToHandled = useRef(false);
  const wasAuthenticated = useRef(false);
  const walletCatchupAttempt = useRef(0);
  const walletAddresses = wallets.map((w) => w.address).join(",");
  const clientHasWallets = wallets.length > 0;

  useEffect(() => {
    registerPrivySignOut(privyLogout);
    return () => registerPrivySignOut(null);
  }, [privyLogout]);

  useEffect(() => {
    if (!ready) return;
    if (wasAuthenticated.current && !authenticated && !isSignOutInProgress()) {
      void useAuthStore.getState().logout();
    }
    wasAuthenticated.current = authenticated;
  }, [ready, authenticated]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || isSignOutInProgress()) {
      if (!authenticated) {
        returnToHandled.current = false;
        walletCatchupAttempt.current = 0;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      // If a sync is already running, mark a retry so the finish handler re-syncs.
      // Wallet creation often cancels the initial auth sync via effect cleanup.
      if (syncInFlight.current || isSignOutInProgress()) {
        syncPending.current = true;
        return;
      }

      do {
        syncPending.current = false;
        syncInFlight.current = true;
        try {
          const token = await getAccessToken();
          if (!token) break;

          const user = await syncPrivySession(token);

          // Always commit fresh server data — cookie is already set.
          setUser(user);

          const linked = userHasLinkedWallet(user);
          if (linked) {
            walletCatchupAttempt.current = 0;
          } else if (
            clientHasWallets &&
            walletCatchupAttempt.current < PRIVY_WALLET_CATCHUP_ATTEMPTS
          ) {
            // Privy client already has the embedded wallet; API linked_accounts may lag.
            walletCatchupAttempt.current += 1;
            syncPending.current = true;
            // Do not abort this delay on effect cleanup — in-flight must finish so
            // syncPending drains (clearing the timer would leave syncInFlight stuck).
            await new Promise((resolve) => setTimeout(resolve, PRIVY_WALLET_CATCHUP_MS));
          }

          if (!cancelled && !returnToHandled.current) {
            const returnTo = useAuthUiStore.getState().consumeReturnTo();
            if (returnTo) {
              returnToHandled.current = true;
              router.push(returnTo);
            }
          }
        } catch {
          // Keep Privy session — bridge retries when wallets/token update.
          break;
        } finally {
          syncInFlight.current = false;
        }
        // Drain pending retries even if this effect instance was cancelled —
        // otherwise first-login wallet creation leaves the user wallet-less in-session.
      } while (syncPending.current && !isSignOutInProgress());
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    authenticated,
    getAccessToken,
    setUser,
    router,
    walletAddresses,
    clientHasWallets,
  ]);

  return null;
}

/** @deprecated Use {@link PrivySessionBridge}. */
export const PrivyAuthBridge = PrivySessionBridge;
