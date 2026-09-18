/** Mobile MetaMask connect→SIWE helpers. Never open MetaMask without an explicit Privy MetaMask click. */

const SIWE_KEY = "tk_privy_wallet_siwe_pending";
/** Set only when the user taps MetaMask inside the Privy modal. */
const MM_FLOW_KEY = "tk_privy_mm_connect_flow";
const MM_FLOW_TTL_MS = 3 * 60_000;

export function clearPrivyWalletLoginIntent(): void {
  try {
    sessionStorage.removeItem(SIWE_KEY);
  } catch {
    /* ignore */
  }
}

export function markMetamaskConnectFlow(): void {
  try {
    sessionStorage.setItem(MM_FLOW_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearMetamaskConnectFlow(): void {
  try {
    sessionStorage.removeItem(MM_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

/** True only after the user explicitly tapped MetaMask in Privy (short TTL). */
export function hasMetamaskConnectFlow(): boolean {
  try {
    const raw = sessionStorage.getItem(MM_FLOW_KEY);
    if (!raw) return false;
    const started = Number(raw);
    if (!Number.isFinite(started) || Date.now() - started > MM_FLOW_TTL_MS) {
      sessionStorage.removeItem(MM_FLOW_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Open Privy's login modal. MetaMask opens only if the user picks it there. */
export function startPrivyLogin(login: () => void): void {
  clearPrivyWalletLoginIntent();
  clearMetamaskConnectFlow();
  login();
}

export function isMobileBrowserUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
