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
    priceHistoryDuration: "7d" | "30d" | "90d" | "180d" | "365d" = "365d",
  ) => ["collection-snapshots", [...sortedKeys], priceHistoryDuration] as const,
  rwaMetadataBatch: (address: string | undefined, tokenIds: readonly number[]) =>
    ["rwa-metadata-batch", address ?? "", [...tokenIds].slice().sort((a, b) => a - b)] as const,
  poketraceMintPreviews: (address: string | undefined, tokenIds: readonly number[]) =>
    ["poketrace-mint-previews", address ?? "", [...tokenIds].slice().sort((a, b) => a - b)] as const,
} as const;

export const marketplaceRqPolicy = {
  /** Active order book — same interval on every page */
  ordersRefetchMs: 30_000,
  ordersStaleMs: 15_000,
  collectionsStaleMs: 5 * 60_000,
  snapshotsStaleMs: 5 * 60_000,
  rwaTokensStaleMs: 60_000,
  metadataBatchStaleMs: 5 * 60_000,
  /** All PokeTrace-backed queries (preview, mint batch, price history) share this freshness window */
  poketraceStaleMs: 5 * 60_000,
  /** Keep resolved PokeTrace payloads in memory while navigating (matches marketplace bundle gc pattern) */
  poketraceGcMs: 24 * 60 * 60 * 1000,
} as const;

/**
 * Single React Query policy for every PokeTrace HTTP surface: preview, batch mint previews, tier price history.
 * Applied via {@link configurePoketraceQueryDefaults} — do not set ad-hoc `staleTime` on those queries.
 */
export const poketraceQueryDefaults = {
  staleTime: marketplaceRqPolicy.poketraceStaleMs,
  gcTime: marketplaceRqPolicy.poketraceGcMs,
  retry: false as const,
  refetchOnMount: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

/** Register defaults for partial keys: `poketrace-mint-previews`, `collection-poketrace`, `collection-poketrace-price-history`. */
export function configurePoketraceQueryDefaults(queryClient: QueryClient): void {
  const d = poketraceQueryDefaults;
  queryClient.setQueryDefaults(["poketrace-mint-previews"], d);
  queryClient.setQueryDefaults(["collection-poketrace"], d);
  queryClient.setQueryDefaults(["collection-poketrace-price-history"], d);
}
