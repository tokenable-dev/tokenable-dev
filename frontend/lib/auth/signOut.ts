import { clearSavedRedeemAddress } from "@/lib/portfolio/redeemDraft";
import { clearAllSellLocalState } from "@/lib/sell/sellFlowDraft";
import {
  getPrivySignOutHandler,
  setSignOutInProgress,
} from "@/lib/privy/session";
import { disconnectAllWagmiWallets } from "@/lib/privy/disconnectWagmi";

export { registerPrivySignOut } from "@/lib/privy/session";

/**
 * Clear Privy session via registered `useLogout` handler.
 * Also disconnects wagmi connectors so a prior MetaMask session cannot stay
 * active after Sign out (Buy must not reopen MetaMask for the next social login).
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
    } else if (fallbackClearTokenableSession) {
      await fallbackClearTokenableSession();
    }
  } finally {
    await disconnectAllWagmiWallets();
    // Avoid leaking ship-to / sell OCR drafts into the next account on the same browser.
    clearSavedRedeemAddress();
    clearAllSellLocalState();
    setSignOutInProgress(false);
  }
}
