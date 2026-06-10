/** Mobile browsers where MetaMask SDK deeplink must stay user-initiated. */
export function isMobileMetaMaskBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/** MetaMask (or other) wallet injected into the page — reconnect does not need a deeplink. */
export function isInjectedEthereumBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as Window & { ethereum?: unknown }).ethereum,
  );
}

type WagmiPersistedStore = {
  state?: {
    connections?: {
      value?: [string, { accounts?: string[] }][];
    };
    current?: string | null;
  };
};

/** True when wagmi still has a saved connector + accounts in localStorage. */
export function hasPersistedWagmiConnection(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("wagmi.store");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as WagmiPersistedStore;
    const entries = parsed?.state?.connections?.value;
    if (!Array.isArray(entries) || entries.length === 0) return false;
    return entries.some(
      ([, conn]) =>
        Array.isArray(conn?.accounts) && conn.accounts.length > 0,
    );
  } catch {
    return false;
  }
}

/**
 * Desktop extension sessions can silently reconnect.
 * Mobile: only when an injected provider exists or wagmi persisted a prior session
 * (avoids opening MetaMask on first visit, restores address after refresh).
 * SSR returns false — wagmi hydrates on the client with the real value.
 */
export function shouldAutoReconnectWalletOnMount(): boolean {
  if (typeof window === "undefined") return false;
  if (!isMobileMetaMaskBrowser()) return true;
  return isInjectedEthereumBrowser() || hasPersistedWagmiConnection();
}
