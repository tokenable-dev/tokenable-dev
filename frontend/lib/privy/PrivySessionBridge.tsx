"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLogout, useLogin, usePrivy, useWallets } from "@privy-io/react-auth";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import {
  isSignOutInProgress,
  registerPrivySignOut,
  syncPrivySession,
} from "@/lib/privy/session";
import { disconnectAllWagmiWallets } from "@/lib/privy/disconnectWagmi";
import { pickPrivyUserEthereumWalletAddress } from "@/lib/privy/wallet";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/** Delay between wallet catch-up POSTs while Privy API lags behind client wallets. */
const WALLET_CATCHUP_DELAYS_MS = [300, 600, 1000, 1500, 2000, 3000, 4000] as const;
/** Privy token / backend session sync — mobile OAuth often needs a beat before `getAccessToken()`. */
const SESSION_SYNC_DELAYS_MS = [0, 400, 800, 1500, 2500, 4000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Keeps Tokenable session in sync with Privy auth.
 * Wagmi wallet alignment runs once in PrivyAppProviders (avoids duplicate setActiveWallet).
 *
 * First social login: embedded wallet often appears after the first POST /auth/privy/session.
 * We keep re-syncing until the Tokenable user has a linked wallet (or attempts are exhausted).
 */
export function PrivySessionBridge() {
  const router = useRouter();
  const catchupAttempt = useRef(0);
  const [loginSyncNonce, setLoginSyncNonce] = useState(0);
  useLogin({
    onComplete: () => {
      catchupAttempt.current = 0;
      setLoginSyncNonce((n) => n + 1);
    },
  });
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const { logout: privyLogout } = useLogout({
    onSuccess: () => {
      void useAuthStore.getState().logout();
    },
  });
  const { wallets } = useWallets();
  const hydrateFromSession = useAuthStore((s) => s.hydrateFromSession);
  const setPrivySessionSyncing = useAuthStore((s) => s.setPrivySessionSyncing);
  const syncInFlight = useRef(false);
  const syncPending = useRef(false);
  const returnToHandled = useRef(false);
  const wasAuthenticated = useRef(false);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const walletAddresses = wallets.map((w) => w.address.toLowerCase()).join(",");
  const privyWalletHint =
    pickPrivyUserEthereumWalletAddress(privyUser)?.toLowerCase() ?? "";

  useEffect(() => {
    registerPrivySignOut(privyLogout);
    return () => registerPrivySignOut(null);
  }, [privyLogout]);

  useEffect(() => {
    if (!ready) return;
    if (wasAuthenticated.current && !authenticated && !isSignOutInProgress()) {
      void useAuthStore.getState().logout();
      void disconnectAllWagmiWallets();
    }
    if (!wasAuthenticated.current && authenticated) {
      catchupAttempt.current = 0;
    }
    wasAuthenticated.current = authenticated;
  }, [ready, authenticated]);

  // Privy user profile or client wallets appeared — restart catch-up window.
  useEffect(() => {
    if (!walletAddresses && !privyWalletHint) return;
    catchupAttempt.current = 0;
  }, [walletAddresses, privyWalletHint]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || isSignOutInProgress()) {
      setPrivySessionSyncing(false);
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
        setPrivySessionSyncing(true);
        try {
          let syncedUser: Awaited<ReturnType<typeof syncPrivySession>> | null = null;

          for (let attempt = 0; attempt < SESSION_SYNC_DELAYS_MS.length; attempt++) {
            if (cancelled || isSignOutInProgress()) break;
            const delay = SESSION_SYNC_DELAYS_MS[attempt] ?? 0;
            if (delay > 0) await sleep(delay);

            const token = await getAccessToken();
            if (!token) continue;

            try {
              syncedUser = await syncPrivySession(token);
              await hydrateFromSession(syncedUser);
              break;
            } catch {
              // Mobile OAuth / site-access gate races — retry with backoff.
            }
          }

          if (!syncedUser || cancelled) break;

          if (userHasLinkedWallet(syncedUser)) {
            catchupAttempt.current = 0;
          } else {
            const clientWalletCount = walletsRef.current.length;
            const hasWalletHint =
              clientWalletCount > 0 ||
              Boolean(privyWalletHint) ||
              Boolean(pickPrivyUserEthereumWalletAddress(privyUser));
            const attempt = catchupAttempt.current;
            const shouldRetry =
              attempt < WALLET_CATCHUP_DELAYS_MS.length &&
              (hasWalletHint || attempt < 3);

            if (shouldRetry) {
              const delay =
                WALLET_CATCHUP_DELAYS_MS[
                  Math.min(attempt, WALLET_CATCHUP_DELAYS_MS.length - 1)
                ]!;
              catchupAttempt.current = attempt + 1;
              syncPending.current = true;
              await sleep(delay);
            }
          }

          if (!cancelled && !returnToHandled.current) {
            const returnTo = useAuthUiStore.getState().consumeReturnTo();
            if (returnTo) {
              returnToHandled.current = true;
              router.push(returnTo);
            }
          }
        } finally {
          syncInFlight.current = false;
          if (!cancelled) {
            setPrivySessionSyncing(false);
          }
        }
        // Drain pending even if this effect was cancelled (wallet list change mid-sync).
      } while (syncPending.current && !isSignOutInProgress() && !cancelled);
    })();

    return () => {
      cancelled = true;
      setPrivySessionSyncing(false);
    };
  }, [
    ready,
    authenticated,
    getAccessToken,
    hydrateFromSession,
    router,
    walletAddresses,
    privyWalletHint,
    privyUser,
    loginSyncNonce,
    setPrivySessionSyncing,
  ]);

  return null;
}
