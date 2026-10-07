"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAuthStore } from "@/store/authStore";

/** GNB + inbox + portfolio: Privy session and Tokenable user must both be active. */
export function useTokenableSessionActive(): boolean {
  const user = useAuthStore((s) => s.user);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  return (
    privyReady &&
    privyAuthenticated &&
    Boolean(user?.id) &&
    !privySessionSyncing
  );
}
