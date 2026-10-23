import type { QueryClient } from "@tanstack/react-query";
import { backendFetch, getApiUrl } from "./api/client";

export type RwaMintSyncResult = {
  accepted: boolean;
  collectionKey: string | null;
  bootstrapped: boolean;
};

/**
 * Notify backend that a mint tx confirmed. Syncs `rwa_tokens` only — marketplace
 * collection rows are created on first ask listing.
 */
export async function syncRwaTokenAfterMint(
  tokenId: number,
): Promise<RwaMintSyncResult> {
  const tid = Math.floor(tokenId);
  if (!Number.isFinite(tid) || tid < 0) {
    return { accepted: false, collectionKey: null, bootstrapped: false };
  }

  try {
    const res = await backendFetch(
      `${getApiUrl()}/marketplace/collections/on-mint`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: tid }),
        timeoutMs: 15_000,
      },
    );
    if (!res.ok) {
      return { accepted: false, collectionKey: null, bootstrapped: false };
    }
    const body = (await res.json()) as RwaMintSyncResult;
    return {
      accepted: body.accepted === true,
      collectionKey: body.collectionKey?.trim().toLowerCase() || null,
      bootstrapped: body.bootstrapped === true,
    };
  } catch {
    return { accepted: false, collectionKey: null, bootstrapped: false };
  }
}

/** @deprecated Use {@link syncRwaTokenAfterMint} */
export async function bootstrapRwaMintMarketData(
  tokenId: number,
): Promise<RwaMintSyncResult> {
  return syncRwaTokenAfterMint(tokenId);
}

/** @deprecated Use {@link syncRwaTokenAfterMint} */
export async function notifyRwaMint(tokenId: number): Promise<RwaMintSyncResult> {
  return syncRwaTokenAfterMint(tokenId);
}

/** @deprecated Collection warms on first listing — no-op kept for imports. */
export async function warmRwaMintMarketCache(
  _qc: QueryClient,
  _input: { tokenId: number; collectionKey: string; gradeLabel?: string },
): Promise<void> {
  void _qc;
  void _input;
}
