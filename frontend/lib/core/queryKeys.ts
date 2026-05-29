import type { QueryClient } from "@tanstack/react-query";

/**
 * Canonical React Query keys — use everywhere (portfolio, My Assets, exchange, modals).
 * Do not stringify snapshot keys with `join`; pass a sorted string[] as the second element.
 */
export const rq = {
  rwaTokens: (address: string) => ["rwa-tokens", address] as const,
  ordersActive: () => ["orders", "active"] as const,
  ordersByTokenBatch: (address: string | undefined, tokenIds: readonly number[]) =>
    ["orders", "by-token-batch", address ?? "", [...tokenIds].slice().sort((a, b) => a - b)] as const,
  collectionsMarketplace: () => ["collections", "marketplace"] as const,
  /**
   * Second element: sorted collection keys. Third: `priceHistoryDuration` for batched snapshots
   * (must match POST body so cache invalidates when window changes).
   */
  collectionSnapshots: (
    sortedKeys: readonly string[],
    priceHistoryDuration: "7d" | "30d" | "90d" | "180d" | "365d" | "max" = "max",
  ) => ["collection-snapshots", [...sortedKeys], priceHistoryDuration] as const,
  rwaMetadataBatch: (address: string | undefined, tokenIds: readonly number[]) =>
    ["rwa-metadata-batch", address ?? "", [...tokenIds].slice().sort((a, b) => a - b)] as const,
  marketMintPreviews: (address: string | undefined, tokenIds: readonly number[]) =>
    ["cardhedger-mint-previews", address ?? "", [...tokenIds].slice().sort((a, b) => a - b)] as const,
  portfolioHidden: (address: string) => ["portfolio-hidden", address] as const,
} as const;

export const marketplaceRqPolicy = {
  /** Active order book — same interval on every page */
  ordersRefetchMs: 30_000,
  ordersStaleMs: 15_000,
  collectionsStaleMs: 5 * 60_000,
  snapshotsStaleMs: 5 * 60_000,
  rwaTokensStaleMs: 60_000,
  metadataBatchStaleMs: 5 * 60_000,
  /** Cardhedger-backed queries (mint batch, portfolio batch, market-series) share this freshness window */
  cardhedgerStaleMs: 5 * 60_000,
  /** Keep resolved Cardhedger payloads in memory while navigating (matches marketplace bundle gc pattern) */
  cardhedgerGcMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * Single React Query policy for market preview/batch/history surfaces.
 * Applied via {@link configureMarketQueryDefaults} — do not set ad-hoc `staleTime` on those queries.
 */
export const marketQueryDefaults = {
  staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
  gcTime: marketplaceRqPolicy.cardhedgerGcMs,
  retry: false as const,
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

/** Register defaults for Cardhedger-backed batch queries (mint previews, portfolio batch). */
export function configureMarketQueryDefaults(queryClient: QueryClient): void {
  const d = marketQueryDefaults;
  queryClient.setQueryDefaults(["cardhedger-mint-previews"], d);
  queryClient.setQueryDefaults(["portfolio-market-batch"], d);
  queryClient.setQueryDefaults(["collection-market-series"], d);
}
