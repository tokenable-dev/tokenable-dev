import type { AuthUser } from "./auth";

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

/** Logged in but portfolio wallet not on Tokenable user yet (Privy embedded catch-up). */
export function shouldDeferPortfolioWalletLink(opts: {
  user: AuthUser | null | undefined;
  hasLinkedWallet: boolean;
  privyAuthenticated: boolean;
  privySessionSyncing: boolean;
  privyWalletCount: number;
}): boolean {
  if (!opts.user || opts.hasLinkedWallet) return false;
  if (opts.privySessionSyncing) return true;
  if (opts.privyAuthenticated && opts.privyWalletCount > 0) return true;
  return false;
}
