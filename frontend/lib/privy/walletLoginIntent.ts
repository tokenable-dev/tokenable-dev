/** Helpers for mobile Privy wallet login — no unsolicited MetaMask prompts. */

const KEY = "tk_privy_wallet_siwe_pending";

export function clearPrivyWalletLoginIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Open Privy's login modal. MetaMask is only prompted when the user picks it there. */
export function startPrivyLogin(login: () => void): void {
  // Clear any leftover SIWE flag so a prior WC session cannot trigger MetaMask
  // on the next page load without an explicit Privy MetaMask click.
  clearPrivyWalletLoginIntent();
  login();
}

export function isMobileBrowserUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
