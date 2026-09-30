import type { AuthUser } from "@/lib/auth/auth";
import { userHasLinkedWallet } from "@/lib/auth/wallets";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import { useAuthStore } from "@/store/authStore";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Social / Google login: Privy embedded wallet often appears before
 * `POST /auth/privy/session` persists `user.wallets` on the Tokenable account.
 */
export async function ensureTokenableWalletSynced(opts: {
  getAccessToken: () => Promise<string | null>;
  hydrateFromSession: (sessionUser: AuthUser) => Promise<AuthUser>;
  /** Client already has a Privy wallet — keep retrying backend sync. */
  privyWalletHint?: boolean;
  maxWaitMs?: number;
}): Promise<boolean> {
  if (userHasLinkedWallet(useAuthStore.getState().user)) return true;

  const deadline = Date.now() + (opts.maxWaitMs ?? 12_000);
  let attempt = 0;

  while (Date.now() < deadline) {
    const synced = await refreshPrivyAuthSession(opts.getAccessToken);
    if (synced) {
      await opts.hydrateFromSession(synced);
    }
    if (userHasLinkedWallet(useAuthStore.getState().user)) return true;

    if (!opts.privyWalletHint && attempt >= 2) break;

    attempt += 1;
    await sleep(Math.min(400 * attempt, 1_200));
  }

  return userHasLinkedWallet(useAuthStore.getState().user);
}
