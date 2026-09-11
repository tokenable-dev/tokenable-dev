import type { AuthUser } from "@/lib/auth";

/** Wait for Privy init / Tokenable session sync before prompting guest sign-in. */
export function shouldDeferGuestSignIn(opts: {
  authInitialized: boolean;
  authLoading: boolean;
  user: AuthUser | null | undefined;
  privyReady: boolean;
  privyAuthenticated: boolean;
  privySessionSyncing: boolean;
}): boolean {
  if (!opts.authInitialized || opts.authLoading || opts.user) return true;
  if (!opts.privyReady) return true;
  if (opts.privyAuthenticated || opts.privySessionSyncing) return true;
  return false;
}
