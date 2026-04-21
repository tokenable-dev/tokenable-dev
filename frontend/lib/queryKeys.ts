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
  /** Second element must be a sorted copy of collection keys (stable reference via useMemo). */
  collectionSnapshots: (sortedKeys: readonly string[]) =>
    ["collection-snapshots", [...sortedKeys]] as const,
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
  poketraceStaleMs: 5 * 60_000,
} as const;
