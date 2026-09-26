import type { SupportedChainId } from "./types";
import { clearCollectionBrowseContext } from "@/lib/marketplace/collectionBrowseContext";
import { clearCollectionCoverSession } from "@/lib/marketplace/collectionCoverSession";
import { bindSellFlowToContract } from "@/lib/sell/sellFlowDraft";

/** Legacy global snapshot LS (pre–per-chain keys). */
const LEGACY_SNAPSHOTS_LS = "tokenable.rq.collection-snapshots-map.v2";

/**
 * Browser caches that are not chain-scoped in React Query must be cleared or
 * rebound when the header network picker changes.
 */
export function runChainSwitchStorageHygiene(
  _prevChainId: SupportedChainId | null,
  _nextChainId: SupportedChainId,
): void {
  if (typeof window === "undefined") return;
  clearCollectionBrowseContext();
  clearCollectionCoverSession();
  try {
    localStorage.removeItem(LEGACY_SNAPSHOTS_LS);
  } catch {
    /* ignore */
  }
  bindSellFlowToContract();
}
