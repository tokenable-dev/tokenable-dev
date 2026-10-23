import type { MarketplaceCollectionSummary } from "./marketplace-collections";
import { backendFetch, getApiUrl } from "./client";

export interface WatchlistResponse {
  collectionKeys: string[];
  items: MarketplaceCollectionSummary[];
}

export async function fetchWatchlist(): Promise<WatchlistResponse> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/watchlist`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to load watchlist" }));
    throw new Error((err as { message?: string }).message ?? "Failed to load watchlist");
  }
  return res.json() as Promise<WatchlistResponse>;
}

export async function addToWatchlist(collectionKey: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/watchlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to save" }));
    throw new Error((err as { message?: string }).message ?? "Failed to save");
  }
}

export async function removeFromWatchlist(collectionKey: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/watchlist`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to remove" }));
    throw new Error((err as { message?: string }).message ?? "Failed to remove");
  }
}
