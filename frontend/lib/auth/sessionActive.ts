"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useAuthStore } from "@/store/authStore";

/**
 * GNB + inbox + portfolio: Privy auth and Tokenable user must both be present.
 * Do not gate on `privySessionSyncing` — background re-sync (wallet catch-up)
 * would flash inbox badges / disable polls every navigation.
 */
export function useTokenableSessionActive(): boolean {
  const user = useAuthStore((s) => s.user);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  return privyReady && privyAuthenticated && Boolean(user?.id);
}
