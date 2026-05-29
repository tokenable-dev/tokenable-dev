import { backendFetch, getApiUrl } from "./client";
import type {
  CollectionMarketSeries,
  CollectionMarketStats,
} from "./marketplace-market-data";

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
        priceHistoryDuration: body.priceHistoryDuration ?? "max",
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
