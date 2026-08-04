import { clearSavedRedeemAddress } from "@/lib/portfolio/redeemDraft";
import {
  getPrivySignOutHandler,
  setSignOutInProgress,
} from "@/lib/privy/session";

export { registerPrivySignOut } from "@/lib/privy/session";

/**
 * Clear Privy session via registered `useLogout` handler.
 * Tokenable cookie is cleared in the logout `onSuccess` callback (PrivySessionBridge).
 */
export async function completeSignOut(
  fallbackClearTokenableSession?: () => Promise<void>,
): Promise<void> {
  setSignOutInProgress(true);
  try {
    const privySignOut = getPrivySignOutHandler();
    if (privySignOut) {
      await privySignOut().catch(() => undefined);
      return;
    }
    if (fallbackClearTokenableSession) {
      await fallbackClearTokenableSession();
    }
  } finally {
    // Avoid leaking ship-to into the next account on the same browser.
    clearSavedRedeemAddress();
    setSignOutInProgress(false);
  }
}
