"use client";

import { useEffect, useRef } from "react";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { disconnectAllWagmiWallets } from "@/lib/privy/disconnectWagmi";
import {
  isPrivySessionSyncSuppressed,
  isSignOutInProgress,
  onAuthSignOutComplete,
  resumePrivySessionSync,
  waitForPrivyAccessTokenCleared,
} from "@/lib/privy/session";
import { startPrivyLogin } from "@/lib/privy/walletLoginIntent";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/** Opens Privy's native login modal when auth UI store requests sign-in. */
export function PrivySignInLauncher() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const signInLaunchNonce = useAuthUiStore((s) => s.signInLaunchNonce);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const { login } = useLogin();
  const { logout } = useLogout();
  const { authenticated, ready, getAccessToken } = usePrivy();
  const tokenableUserId = useAuthStore((s) => s.user?.id);
  const launchInFlight = useRef(false);

  useEffect(() => {
    if (!signInOpen || !ready) return;

    const hasTokenableUser = Boolean(useAuthStore.getState().user?.id);
    if (
      authenticated &&
      hasTokenableUser &&
      !isPrivySessionSyncSuppressed()
    ) {
      closeSignIn();
      return;
    }

    if (isSignOutInProgress()) {
      return onAuthSignOutComplete(() => {
        const st = useAuthUiStore.getState();
        if (!st.signInOpen) return;
        openSignIn({ returnTo: st.pendingReturnTo ?? undefined });
      });
    }

    if (launchInFlight.current) return;

    launchInFlight.current = true;
    const returnTo = useAuthUiStore.getState().pendingReturnTo;
    closeSignIn();

    void (async () => {
      try {
        const hasTokenableUser = Boolean(useAuthStore.getState().user?.id);

        if (authenticated && hasTokenableUser && !isPrivySessionSyncSuppressed()) {
          return;
        }

        if (isPrivySessionSyncSuppressed() && !authenticated) {
          resumePrivySessionSync();
        }

        if (authenticated) {
          await disconnectAllWagmiWallets();
          await logout().catch(() => undefined);
          await waitForPrivyAccessTokenCleared();
          await disconnectAllWagmiWallets();
        }

        if (isSignOutInProgress()) return;

        const stillAuthed = Boolean(await getAccessToken().catch(() => null));
        if (stillAuthed) {
          await logout().catch(() => undefined);
          await waitForPrivyAccessTokenCleared();
        }

        startPrivyLogin(login, { returnTo: returnTo ?? undefined });
      } finally {
        launchInFlight.current = false;
      }
    })();
  }, [
    signInOpen,
    signInLaunchNonce,
    login,
    logout,
    closeSignIn,
    openSignIn,
    authenticated,
    ready,
    getAccessToken,
    tokenableUserId,
  ]);

  return null;
}
