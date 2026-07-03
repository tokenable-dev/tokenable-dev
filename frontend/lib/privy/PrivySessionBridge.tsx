"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLogout, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import {
  isSignOutInProgress,
  registerPrivySignOut,
  syncPrivySession,
} from "@/lib/privy/session";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/**
 * Keeps Tokenable session in sync with Privy auth.
 * Wagmi wallet alignment runs in AccountWalletAligner only (avoids duplicate setActiveWallet).
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
  const walletAddresses = wallets.map((w) => w.address).join(",");

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
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      // If a sync is already running, mark a retry so the finish handler re-syncs.
      // This prevents the race where wallet creation cancels the initial auth sync.
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

          // Always commit fresh server data regardless of cancellation —
          // the cookie is already set and the user data is authoritative.
          setUser(user);

          // Navigation: only if this run wasn't superseded by a newer one.
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
        // If a sync was requested while we were running, loop and run it now.
      } while (syncPending.current && !cancelled && !isSignOutInProgress());
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
  ]);

  return null;
}

/** @deprecated Use {@link PrivySessionBridge}. */
export const PrivyAuthBridge = PrivySessionBridge;
