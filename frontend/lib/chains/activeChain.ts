import { DEFAULT_CHAIN_ID } from "./registry";
import { getActiveChainIdForApi } from "./apiHeader";

/** Chain id for React Query keys — follows AppChainProvider / API header. */
export function activeRqChainId(): number {
  return getActiveChainIdForApi() ?? DEFAULT_CHAIN_ID;
}
