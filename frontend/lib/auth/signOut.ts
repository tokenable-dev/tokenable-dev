import { clearSavedRedeemAddress } from "@/lib/portfolio/redeemDraft";
import { clearAllSellLocalState } from "@/lib/sell/sellFlowDraft";
import {
  getPrivySignOutHandler,
  notifyAuthSignOutComplete,
  setSignOutInProgress,
  suppressPrivySessionSyncAfterSignOut,
  waitForPrivyAccessTokenCleared,
} from "@/lib/privy/session";
import { disconnectAllWagmiWallets } from "@/lib/privy/disconnectWagmi";
import { AUTH_RETURN_TO_KEY } from "@/lib/auth/returnTo";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export { registerPrivySignOut } from "@/lib/privy/session";

const AUTH_PERSISTENCE_PREFIXES = [
  AUTH_RETURN_TO_KEY,
  "tk_add_email_deferred:",
] as const;

function removeMatchingStorageKeys(storage: Storage): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (AUTH_PERSISTENCE_PREFIXES.some((p) => key === p || key.startsWith(p))) {
        storage.removeItem(key);
      }
    }
  } catch {
    /* private mode */
  }
}

/** Drop login persistence so the next account starts clean. */
export function clearClientAuthPersistence(): void {
  if (typeof window === "undefined") return;
  removeMatchingStorageKeys(sessionStorage);
  removeMatchingStorageKeys(localStorage);
}

/**
 * Clear Privy + Tokenable sessions and client auth persistence.
 * Tokenable cookie is cleared here (not only in Privy `onSuccess`) so mobile
 * cannot leave an orphan Privy session that blocks `login()` on the next tap.
 */
export async function completeSignOut(
  clearTokenableSession?: () => Promise<void>,
): Promise<void> {
  setSignOutInProgress(true);
  suppressPrivySessionSyncAfterSignOut();
  useAuthUiStore.getState().resetForSignOut();
  clearClientAuthPersistence();

  const clearTokenable =
    clearTokenableSession ?? (() => useAuthStore.getState().logout());

  try {
    await disconnectAllWagmiWallets();

    await clearTokenable().catch(() => undefined);

    const privySignOut = getPrivySignOutHandler();
    if (privySignOut) {
      await privySignOut().catch(() => undefined);
    }
    await waitForPrivyAccessTokenCleared();
    await disconnectAllWagmiWallets();
  } finally {
    clearSavedRedeemAddress();
    clearAllSellLocalState();
    useAuthStore.getState().setPrivySessionSyncing(false);
    setSignOutInProgress(false);
    notifyAuthSignOutComplete();
  }
}
