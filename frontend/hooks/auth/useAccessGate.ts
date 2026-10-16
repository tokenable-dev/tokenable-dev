"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  resolveHeaderNavGate,
  type HeaderNavMinLevel,
} from "@/lib/auth/accountAccess";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export function useAccessGate(minLevel: HeaderNavMinLevel, returnTo: string) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const openKyc = useAuthUiStore((s) => s.openKyc);

  const canAccess = useMemo(
    () => resolveHeaderNavGate(user, minLevel, returnTo).action === "allow",
    [user, minLevel, returnTo],
  );

  const runAccessGate = useCallback(
    (onAllowed?: () => void): boolean => {
      const gate = resolveHeaderNavGate(user, minLevel, returnTo);
      switch (gate.action) {
        case "allow":
          onAllowed?.();
          return true;
        case "sign-in":
          openSignIn({ returnTo: gate.returnTo });
          return false;
        case "connect-wallet":
          openConnectWallet({ returnTo: gate.returnTo });
          return false;
        case "kyc":
          openKyc({ returnTo: gate.returnTo });
          return false;
      }
    },
    [user, minLevel, returnTo, openSignIn, openConnectWallet, openKyc],
  );

  const navigateIfAllowed = useCallback(
    (href: string) => {
      runAccessGate(() => router.push(href));
    },
    [runAccessGate, router],
  );

  return { canAccess, runAccessGate, navigateIfAllowed };
}
