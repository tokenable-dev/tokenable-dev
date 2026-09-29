"use client";

import { useEffect, useRef } from "react";
import { useLogin, useLogout, usePrivy } from "@privy-io/react-auth";
import { disconnectAllWagmiWallets } from "@/lib/privy/disconnectWagmi";
import { isSignOutInProgress } from "@/lib/privy/session";
import { startPrivyLogin } from "@/lib/privy/walletLoginIntent";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

/** Opens Privy's native login modal when auth UI store requests sign-in. */
export function PrivySignInLauncher() {
  const signInOpen = useAuthUiStore((s) => s.signInOpen);
  const closeSignIn = useAuthUiStore((s) => s.closeSignIn);
  const { login } = useLogin();
  const { logout } = useLogout();
  const { authenticated, ready } = usePrivy();
  const tokenableUserId = useAuthStore((s) => s.user?.id);
  const launchInFlight = useRef(false);

  useEffect(() => {
    if (!signInOpen || launchInFlight.current || !ready) return;
    if (isSignOutInProgress()) return;

    launchInFlight.current = true;
    closeSignIn();
    const returnTo = useAuthUiStore.getState().pendingReturnTo;

    void (async () => {
      try {
        const hasTokenableUser = Boolean(useAuthStore.getState().user?.id);
        if (authenticated && hasTokenableUser) return;

        // Tokenable signed out but Privy still authenticated (common on mobile).
        if (authenticated && !hasTokenableUser) {
          await logout().catch(() => undefined);
          await disconnectAllWagmiWallets();
        }

        if (isSignOutInProgress()) return;
        startPrivyLogin(login, { returnTo: returnTo ?? undefined });
      } finally {
        launchInFlight.current = false;
      }
    })();
  }, [
    signInOpen,
    login,
    logout,
    closeSignIn,
    authenticated,
    ready,
    tokenableUserId,
  ]);

  return null;
}
