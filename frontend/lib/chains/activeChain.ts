import { platformDefaultChainId } from "./defaultChainByHost";
import { getActiveChainIdForApi } from "./apiHeader";
import { isChainConfigured } from "./registry";
import { SUPPORTED_CHAIN_IDS, type SupportedChainId } from "./types";

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
  return getActiveChainIdForApi() ?? platformDefaultChainId();
}

/** Header network picker value from localStorage (null if missing / invalid). */
export function readPersistedAppChainId(): SupportedChainId | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(APP_CHAIN_STORAGE_KEY);
  const n = Number(raw);
  if (!SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) return null;
  if (!isChainConfigured(n as SupportedChainId)) return null;
  return n as SupportedChainId;
}
