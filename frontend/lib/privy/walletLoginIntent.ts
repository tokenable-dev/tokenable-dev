/** Shared browser helpers used by Privy login UI and event landing. */

/** Open Privy's login modal. MetaMask opens only if the user picks it there. */
export function startPrivyLogin(login: () => void): void {
  login();
}

export function isMobileBrowserUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
