import { DEFAULT_CHAIN_ID } from "./registry";
import { getActiveChainIdForApi } from "./apiHeader";

/** localStorage key for the header network picker (AppChainProvider). */
export const APP_CHAIN_STORAGE_KEY = "tokenable:chainId";

/**
 * Dispatched on `window` when the app chain changes so PrivyProvider (mounted
 * above AppChainProvider) can flip MoonPay `useSandbox` for Polygon live vs
 * Sepolia sandbox without remounting the whole auth tree.
 */
export const APP_CHAIN_CHANGED_EVENT = "tokenable:chain-changed";

export function notifyAppChainChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APP_CHAIN_CHANGED_EVENT));
}

/** Chain id for React Query keys — follows AppChainProvider / API header. */
export function activeRqChainId(): number {
  return getActiveChainIdForApi() ?? DEFAULT_CHAIN_ID;
}
