/** Session flag: user opened Privy login and may need mobile SIWE auto-continue. */

const KEY = "tk_privy_wallet_siwe_pending";
const TTL_MS = 5 * 60_000;

export function markPrivyWalletLoginIntent(): void {
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function clearPrivyWalletLoginIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasPrivyWalletLoginIntent(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    const started = Number(raw);
    if (!Number.isFinite(started) || Date.now() - started > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Mark mobile SIWE intent, then open Privy's login modal. */
export function startPrivyLogin(login: () => void): void {
  markPrivyWalletLoginIntent();
  login();
}

export function isMobileBrowserUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
