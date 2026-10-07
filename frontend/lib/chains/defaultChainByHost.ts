import type { SupportedChainId } from "./types";
import { DEFAULT_CHAIN_ID, isChainConfigured } from "./registry";

/** One EC2 stack, two hostnames — public default chain (no header switcher). */
const DEFAULT_CHAIN_BY_HOST: Record<string, SupportedChainId> = {
  "app.tokenable.io": 1,
  "tokenable-dev.com": 11155111,
  "www.tokenable-dev.com": 11155111,
};

export function defaultChainIdForHost(
  hostname: string | null | undefined,
): SupportedChainId | null {
  const key = hostname?.trim().toLowerCase();
  if (!key) return null;
  const chainId = DEFAULT_CHAIN_BY_HOST[key];
  if (!chainId || !isChainConfigured(chainId)) return null;
  return chainId;
}

/** Hostname map, then `NEXT_PUBLIC_DEFAULT_CHAIN_ID` / registry fallback. */
export function platformDefaultChainId(hostname?: string | null): SupportedChainId {
  const host =
    hostname ??
    (typeof window !== "undefined" ? window.location.hostname : undefined);
  return defaultChainIdForHost(host) ?? DEFAULT_CHAIN_ID;
}
