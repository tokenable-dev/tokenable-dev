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

/** Delay between wallet catch-up POSTs while Privy API lags behind client wallets. */
const WALLET_CATCHUP_DELAYS_MS = [300, 600, 1000, 1500, 2000, 3000, 4000] as const;

/**
 * Keeps Tokenable session in sync with Privy auth.
 * Wagmi wallet alignment runs in AccountWalletAligner only (avoids duplicate setActiveWallet).
 *
 * First social login: embedded wallet often appears after the first POST /auth/privy/session.
 * We keep re-syncing until the Tokenable user has a linked wallet (or attempts are exhausted).
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
  const catchupAttempt = useRef(0);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const walletAddresses = wallets.map((w) => w.address.toLowerCase()).join(",");

  useEffect(() => {
    registerPrivySignOut(privyLogout);
    return () => registerPrivySignOut(null);
  }, [privyLogout]);

  useEffect(() => {
    if (!ready) return;
    if (wasAuthenticated.current && !authenticated && !isSignOutInProgress()) {
      void useAuthStore.getState().logout();
    }
    if (!wasAuthenticated.current && authenticated) {
      catchupAttempt.current = 0;
    }
    wasAuthenticated.current = authenticated;
  }, [ready, authenticated]);

  // New client wallets → allow another catch-up window (Privy API may still be empty).
  useEffect(() => {
    if (!walletAddresses) return;
    catchupAttempt.current = 0;
  }, [walletAddresses]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || isSignOutInProgress()) {
      if (!authenticated) {
        returnToHandled.current = false;
        catchupAttempt.current = 0;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
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
          setUser(user);

          if (userHasLinkedWallet(user)) {
            catchupAttempt.current = 0;
          } else {
            const clientWalletCount = walletsRef.current.length;
            const attempt = catchupAttempt.current;
            const shouldRetry =
              attempt < WALLET_CATCHUP_DELAYS_MS.length &&
              // Always retry a few times after login; prefer when client already has wallets.
              (clientWalletCount > 0 || attempt < 3);

            if (shouldRetry) {
              const delay =
                WALLET_CATCHUP_DELAYS_MS[
                  Math.min(attempt, WALLET_CATCHUP_DELAYS_MS.length - 1)
                ]!;
              catchupAttempt.current = attempt + 1;
              syncPending.current = true;
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          if (!cancelled && !returnToHandled.current) {
            const returnTo = useAuthUiStore.getState().consumeReturnTo();
            if (returnTo) {
              returnToHandled.current = true;
              router.push(returnTo);
            }
          }
        } catch {
          break;
        } finally {
          syncInFlight.current = false;
        }
        // Drain pending even if this effect was cancelled (wallet list change mid-sync).
      } while (syncPending.current && !isSignOutInProgress());
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, setUser, router, walletAddresses]);

  return null;
}

/** @deprecated Use {@link PrivySessionBridge}. */
export const PrivyAuthBridge = PrivySessionBridge;
