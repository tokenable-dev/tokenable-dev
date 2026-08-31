import { backendFetch, getApiUrl } from "./client";
import type {
  CollectionMarketSeries,
  CollectionMarketStats,
} from "./marketplace-market-data";
import { MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS } from "./marketplace-market-data";

/** Must match backend `TokenCollectionKeysDto` `@ArrayMaxSize(120)`. */
export const TOKEN_COLLECTION_KEYS_BATCH_MAX = 120;

/** Parallel HTTP chunks when a wallet has more keys/tokens than one request allows. */
const PORTFOLIO_HTTP_CHUNK_PARALLEL = 3;

/** Portfolio batch — same shapes as collection stats + market series. */
export interface PortfolioMarketBatchItem {
  collectionKey: string;
  stats: CollectionMarketStats | null;
  series: CollectionMarketSeries | null;
}

export async function postPortfolioCollectionMarketBatch(body: {
  collectionKeys: string[];
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "365d" | "max";
}): Promise<{ items: PortfolioMarketBatchItem[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/portfolio-market-batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionKeys: body.collectionKeys,
        priceHistoryDuration: body.priceHistoryDuration ?? "365d",
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to load portfolio market batch",
    );
  }
  return res.json() as Promise<{ items: PortfolioMarketBatchItem[] }>;
}

export async function postTokenCollectionKeysByTokenIds(
  tokenIds: number[],
): Promise<Record<number, string>> {
  const ids = [...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n))))].filter(
    (n) => Number.isFinite(n) && n >= 0,
  );
  if (ids.length === 0) return {};
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/token-collection-keys`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenIds: ids }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to resolve collection keys by token IDs",
    );
  }
  const j = (await res.json()) as { items?: Record<number, string> };
  return j.items ?? {};
}

export async function postTokenCollectionKeysByTokenIdsBatched(
  tokenIds: number[],
): Promise<Record<number, string>> {
  const ids = [...new Set((tokenIds ?? []).map((n) => Math.floor(Number(n))))].filter(
    (n) => Number.isFinite(n) && n >= 0,
  );
  if (ids.length === 0) return {};

  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += TOKEN_COLLECTION_KEYS_BATCH_MAX) {
    chunks.push(ids.slice(i, i + TOKEN_COLLECTION_KEYS_BATCH_MAX));
  }

  const merged: Record<number, string> = {};
  for (let i = 0; i < chunks.length; i += PORTFOLIO_HTTP_CHUNK_PARALLEL) {
    const parts = await Promise.all(
      chunks
        .slice(i, i + PORTFOLIO_HTTP_CHUNK_PARALLEL)
        .map((chunk) => postTokenCollectionKeysByTokenIds(chunk)),
    );
    for (const part of parts) Object.assign(merged, part);
  }
  return merged;
}

export async function postPortfolioCollectionMarketBatchBatched(body: {
  collectionKeys: string[];
  priceHistoryDuration?: "7d" | "30d" | "90d" | "180d" | "365d" | "max";
}): Promise<{ items: PortfolioMarketBatchItem[] }> {
  const keys = [
    ...new Set(
      (body.collectionKeys ?? [])
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();
  if (keys.length === 0) return { items: [] };

  const max = MARKETPLACE_COLLECTION_SNAPSHOTS_MAX_KEYS;
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += max) {
    chunks.push(keys.slice(i, i + max));
  }

  const items: PortfolioMarketBatchItem[] = [];
  for (let i = 0; i < chunks.length; i += PORTFOLIO_HTTP_CHUNK_PARALLEL) {
    const packs = await Promise.all(
      chunks.slice(i, i + PORTFOLIO_HTTP_CHUNK_PARALLEL).map((chunk) =>
        postPortfolioCollectionMarketBatch({
          collectionKeys: chunk,
          priceHistoryDuration: body.priceHistoryDuration,
        }),
      ),
    );
    for (const pack of packs) items.push(...pack.items);
  }
  return { items };
}

export interface PortfolioDailySnapshotItem {
  walletAddress: string;
  snapshotDateKst: string;
  snapshotAt: string;
  totalValueUsd: number;
  cardCount: number;
}

export async function getPortfolioHiddenHoldings(
  walletAddress: string,
): Promise<number[]> {
  const enc = encodeURIComponent(walletAddress);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/hidden/${enc}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        'Failed to load hidden portfolio holdings',
    );
  }
  const j = (await res.json()) as { tokenIds?: number[] };
  return (j.tokenIds ?? [])
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

export async function hidePortfolioHolding(
  walletAddress: string,
  tokenId: number,
): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/portfolio/hidden`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, tokenId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? 'Failed to hide holding',
    );
  }
}

export async function unhidePortfolioHolding(
  walletAddress: string,
  tokenId: number,
): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/portfolio/hidden`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, tokenId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? 'Failed to unhide holding',
    );
  }
}

export type PortfolioCostBasisSource =
  | 'manual'
  | 'vault_delivery'
  | 'marketplace_buy';

export type PortfolioHoldingBatchItem = {
  tokenId: number;
  hidden: boolean;
  costBasisUsd: number | null;
  costBasisSource: PortfolioCostBasisSource | null;
  acquiredAt: string | null;
};

export async function postPortfolioHoldingsBatch(
  walletAddress: string,
  tokenIds: number[],
): Promise<{ items: PortfolioHoldingBatchItem[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/holdings/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, tokenIds }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        'Failed to load portfolio holdings',
    );
  }
  return res.json() as Promise<{ items: PortfolioHoldingBatchItem[] }>;
}

export async function putPortfolioCostBasis(
  walletAddress: string,
  tokenId: number,
  costBasisUsd: number,
): Promise<void> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/holdings/cost-basis`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, tokenId, costBasisUsd }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? 'Failed to save cost basis',
    );
  }
}

export async function getPortfolioDailySnapshots(
  walletAddress: string,
  limit = 32,
): Promise<{
  items: PortfolioDailySnapshotItem[];
  latest24h: { pnlUsd: number | null; pnlPct: number | null };
}> {
  const enc = encodeURIComponent(walletAddress);
  const sp = new URLSearchParams();
  sp.set('limit', String(Math.max(2, Math.min(120, Math.floor(limit)))));
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/daily/${enc}?${sp.toString()}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        'Failed to load portfolio daily snapshots',
    );
  }
  return res.json() as Promise<{
    items: PortfolioDailySnapshotItem[];
    latest24h: { pnlUsd: number | null; pnlPct: number | null };
  }>;
}
