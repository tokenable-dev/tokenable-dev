import type { QueryClient } from "@tanstack/react-query";
import { backendFetch, getApiUrl } from "./api/client";
import {
  getCollectionPlatformTrades,
  postBatchMintMarketPreviews,
  postMarketplaceCollectionSnapshotsBatched,
} from "./api/marketplace-market-data";
import { postTokenCollectionKeysByTokenIds } from "./api/portfolio";
import { marketplaceApiRetryDelay, marketplaceRqPolicy, rq } from "./queryKeys";

export type RwaMintBootstrapResult = {
  accepted: boolean;
  collectionKey: string | null;
  bootstrapped: boolean;
};

const ON_MINT_MAX_ATTEMPTS = 5;
const ON_MINT_BASE_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Notify backend of a new mint and await marketplace collection bootstrap.
 * Retries transient failures (dev hot-reload, IPFS propagation lag).
 */
export async function bootstrapRwaMintMarketData(
  tokenId: number,
): Promise<RwaMintBootstrapResult> {
  const tid = Math.floor(tokenId);
  if (!Number.isFinite(tid) || tid < 0) {
    return { accepted: false, collectionKey: null, bootstrapped: false };
  }

  let lastResult: RwaMintBootstrapResult = {
    accepted: false,
    collectionKey: null,
    bootstrapped: false,
  };

  for (let attempt = 0; attempt < ON_MINT_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(marketplaceApiRetryDelay(attempt - 1) + ON_MINT_BASE_DELAY_MS);
    }

    try {
      const res = await backendFetch(
        `${getApiUrl()}/marketplace/collections/on-mint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokenId: tid }),
        },
      );

      if (!res.ok) {
        continue;
      }

      const body = (await res.json()) as RwaMintBootstrapResult;
      lastResult = {
        accepted: body.accepted === true,
        collectionKey: body.collectionKey?.trim().toLowerCase() || null,
        bootstrapped: body.bootstrapped === true,
      };

      if (lastResult.bootstrapped && lastResult.collectionKey) {
        return lastResult;
      }
    } catch {
      // retry
    }
  }

  return lastResult;
}

/** @deprecated Use {@link bootstrapRwaMintMarketData} — kept for call-site compatibility. */
export async function notifyRwaMint(tokenId: number): Promise<RwaMintBootstrapResult> {
  return bootstrapRwaMintMarketData(tokenId);
}

/**
 * Prefetch trades tape, snapshot, and mint preview so the list modal
 * "Need suggestions" panel is warm right after mint.
 */
export async function warmRwaMintMarketCache(
  qc: QueryClient,
  input: { tokenId: number; collectionKey: string; gradeLabel?: string },
): Promise<void> {
  const key = input.collectionKey.toLowerCase();
  const { tokenId, gradeLabel } = input;

  await Promise.allSettled([
    qc.prefetchQuery({
      queryKey: rq.collectionPlatformTrades(key, tokenId, gradeLabel),
      queryFn: () =>
        getCollectionPlatformTrades(key, {
          bootstrapTokenId: tokenId,
          grade: gradeLabel,
        }),
      staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    }),
    qc.prefetchQuery({
      queryKey: rq.collectionSnapshots([key], "max"),
      queryFn: () => postMarketplaceCollectionSnapshotsBatched([key], "max"),
      staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    }),
    qc.prefetchQuery({
      queryKey: ["list-rwa-mint-preview", tokenId] as const,
      queryFn: () => postBatchMintMarketPreviews([tokenId]),
      staleTime: marketplaceRqPolicy.snapshotsStaleMs,
    }),
    qc.prefetchQuery({
      queryKey: rq.tokenCollectionKey(tokenId),
      queryFn: async () => {
        const map = await postTokenCollectionKeysByTokenIds([tokenId]);
        return map[tokenId]?.trim().toLowerCase() || null;
      },
      staleTime: 60_000,
    }),
  ]);
}
