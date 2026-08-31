import type { QueryClient } from "@tanstack/react-query";

/**
 * Canonical React Query keys — use everywhere (portfolio, My Assets, exchange, modals).
 *
 * Key design rules:
 *  1. Identity  — keys use primitive values or spread arrays (no stringified JSON).
 *  2. No UI state — open/modal booleans must NOT appear in query keys; use `enabled` instead.
 *  3. Sig naming — any derived/computed identity string passed as a key element must be
 *                  named with the suffix `Sig` at the call site
 *                  (e.g. `portfolioMarketBatchSig`, `portfolioBucketKeysSig`, `floorAskMetadataSig`).
 *  4. Sorted arrays — any array element must be sorted so cache is order-independent.
 */
export const rq = {
  // ── Existing keys (do not rename) ──────────────────────────────────────────

  rwaTokens: (address: string, chainId: number) =>
    ["rwa-tokens", chainId, address] as const,
  ordersActive: (chainId: number) => ["orders", "active", chainId] as const,
  ordersByOfferer: (
    address: string,
    side: "ask" | "bid",
    chainId: number,
  ) =>
    ["orders", "by-offerer", chainId, address.trim().toLowerCase(), side] as const,
  ordersByTokenBatch: (
    address: string | undefined,
    tokenIds: readonly number[],
    chainId: number,
  ) =>
    [
      "orders",
      "by-token-batch",
      chainId,
      address ?? "",
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  collectionsMarketplace: (chainId: number) =>
    ["collections", "marketplace", chainId] as const,
  /** Search page infinite query (`GET /marketplace/collections?q=`). Do not share with typeahead. */
  collectionsSearch: (chainId: number, q: string) =>
    ["collections", "search", chainId, q] as const,
  /** GNB / hero typeahead — same API, different cache shape than infinite `pages`. */
  collectionsSearchTypeahead: (chainId: number, q: string) =>
    ["collections", "search-typeahead", chainId, q] as const,
  /** GNB + search page cert/card hits (`GET /marketplace/search`). */
  catalogSearch: (chainId: number, q: string) =>
    ["catalog", "search", chainId, q] as const,
  /** Full marketplace catalog (cursor walk) — home Top movers / Just vaulted. */
  homeAllCollections: (chainId: number) =>
    ["collections", "marketplace", "all", chainId] as const,
  /** Landing dashboard — Card Ladder category indexes (Pokemon / MLB / NFL / NBA). */
  cardladderIndexes: () => ["cardladder-indexes"] as const,
  /**
   * Second element: sorted collection keys. Third: `priceHistoryDuration` for batched snapshots
   * (must match POST body so cache invalidates when window changes).
   */
  collectionSnapshots: (
    sortedKeys: readonly string[],
    priceHistoryDuration: "7d" | "30d" | "90d" | "180d" | "365d" | "max" = "max",
  ) => ["collection-snapshots", [...sortedKeys], priceHistoryDuration] as const,
  rwaMetadataBatch: (
    address: string | undefined,
    tokenIds: readonly number[],
    chainId: number,
  ) =>
    [
      "rwa-metadata-batch",
      chainId,
      address ?? "",
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  selfVaultPartnerEligibility: (wallet: string, chainId: number) =>
    ["self-vault-partner-eligibility", chainId, wallet.toLowerCase()] as const,
  partnerMe: () => ["partner-me"] as const,
  partnerRedeems: () => ["partner-me", "redeems"] as const,
  vaultSubmissions: () => ["vault-submissions"] as const,
  rwaVaultInfoBatch: (
    address: string | undefined,
    tokenIds: readonly number[],
    chainId: number,
  ) =>
    [
      "rwa-vault-info-batch",
      chainId,
      address ?? "",
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  marketMintPreviews: (
    address: string | undefined,
    tokenIds: readonly number[],
    chainId: number,
  ) =>
    [
      "cardhedger-mint-previews",
      chainId,
      address ?? "",
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  portfolioHidden: (address: string, chainId: number) =>
    ["portfolio-hidden", chainId, address] as const,
  portfolioHoldings: (
    address: string,
    tokenIds: readonly number[],
    chainId: number,
  ) =>
    [
      "portfolio-holdings",
      chainId,
      address.toLowerCase(),
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  /** Collection labels/covers for portfolio bid rows (sorted keys). */
  portfolioBidCollections: (sortedKeys: readonly string[]) =>
    ["portfolio-bid-collections", [...sortedKeys]] as const,
  /** Collection bids placed by wallet (portfolio). */
  portfolioBids: (address: string, chainId: number) =>
    ["portfolio-bids", address, chainId] as const,
  /** Fulfilled trades for portfolio Activity / History tab. */
  portfolioActivity: (address: string, chainId: number) =>
    ["portfolio-activity", address, chainId] as const,
  userWatchlist: (userId: string, chainId: number) =>
    ["user-watchlist", userId, chainId] as const,
  buyerListingAlert: (userId: string, collectionKey: string) =>
    ["buyer-listing-alert", userId, collectionKey.trim().toLowerCase()] as const,
  marketplaceNotifications: (userId: string, chainId: number) =>
    ["marketplace-notifications", userId, chainId] as const,

  // ── Collection ─────────────────────────────────────────────────────────────

  /** Single collection detail page (`/marketplace/collections/:key`). */
  collectionDetail: (key: string, chainId: number) =>
    ["marketplace-collection", key, chainId] as const,
  /**
   * Market price series for a collection.
   * Duration must be included so that switching the chart window bypasses the cache.
   */
  collectionMarketSeries: (
    key: string,
    duration: "7d" | "30d" | "90d" | "180d" | "365d" | "max" = "max",
    chainId: number,
  ) => ["collection-market-series", key, duration, chainId] as const,
  /** Cardhedger all-grade catalog for collection chart picker. */
  collectionGradeCatalog: (key: string, live = false) =>
    ["collection-grade-catalog", key, live] as const,
  /** Admin-only AI market brief for a collection. */
  collectionAiInsight: (key: string) => ["collection-ai-insight", key] as const,
  /** Cardhedger price history for a selected grade label. */
  collectionGradeSeries: (key: string, grade: string, days: number) =>
    ["collection-grade-series", key, grade, days] as const,
  /** On-chain platform trades for a collection. */
  collectionPlatformTrades: (
    key: string,
    chainId: number,
    bootstrapTokenId?: number,
    grade?: string,
  ) =>
    bootstrapTokenId != null
      ? ([
          "collection-platform-trades",
          key,
          chainId,
          bootstrapTokenId,
          grade ?? "",
        ] as const)
      : grade != null && grade.length > 0
        ? (["collection-platform-trades", key, chainId, grade] as const)
        : (["collection-platform-trades", key, chainId] as const),
  /** RWA card detail trades (platform + Cardhedger comps, collection optional). */
  rwaTokenTrades: (tokenId: number, chainId: number, grade?: string) =>
    ["rwa-token-trades", tokenId, chainId, grade ?? ""] as const,
  /** Metadata rows for RWA tokens listed under a collection. */
  collectionListingsMetadata: (key: string, tokenIds: readonly number[]) =>
    [
      "collection-listings-metadata",
      key,
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  /**
   * Wallet-owned tokens eligible for listing in a specific collection.
   * UI state (e.g. modal `open` boolean) must NOT be included here — use
   * `enabled: open && ...` in the query instead. This 3-element form is
   * also the correct prefix for invalidation after listing or cancellation.
   */
  collectionOwnedRwa: (addr: string, key: string) =>
    ["collection-owned-rwa", addr, key] as const,

  // ── Orders ─────────────────────────────────────────────────────────────────

  /** Active ask order for a single token (used in RWA detail / list modal). */
  orderByToken: (tokenId: number) => ["orders", "by-token-active", tokenId] as const,
  /** Full order record fetched by orderHash (used in list-rwa fulfill flow). */
  orderDetail: (hash: string) => ["orders", "detail", hash] as const,

  // ── RWA / Metadata ─────────────────────────────────────────────────────────

  /** Single RWA resolved asset (tokenURI + metadata + imageUrl). */
  rwaAssetDetail: (tokenId: number) => ["marketplace-detail-metadata", tokenId] as const,
  /** Admin — all RWA registry cards (listed + unlisted). */
  adminRwaCards: (chainId: number) => ["admin-rwa-cards", chainId] as const,
  adminCustodyNfts: (chainId: number) => ["admin-custody-nfts", chainId] as const,
  adminVaultSubmissions: (status?: string, q?: string) =>
    ["admin-vault-submissions", status ?? "all", q ?? ""] as const,
  adminVaultSubmissionCounts: () => ["admin-vault-submission-counts"] as const,
  adminVaultSubmission: (id: string) => ["admin-vault-submission", id] as const,
  adminPsaArrivalReviews: (status?: string) =>
    ["admin-psa-arrival-reviews", status ?? "pending"] as const,
  adminPsaVaultedReviews: (status?: string) =>
    ["admin-psa-vaulted-reviews", status ?? "pending"] as const,
  adminVaultMintQueue: (q?: string) =>
    ["admin-vault-mint-queue", q ?? ""] as const,
  adminSelfVaultSettlements: (
    chainId: number,
    status?: string,
  ) => ["admin-self-vault-settlements", chainId, status ?? "all"] as const,
  adminRedeems: (status?: string) =>
    ["admin-redeems", status ?? "all"] as const,
  adminBulkMintJob: (jobId: string) => ["admin-bulk-mint-job", jobId] as const,
  adminBulkMintJobs: (partnerId?: string) =>
    ["admin-bulk-mint-jobs", partnerId ?? "all"] as const,
  adminPartnerInventory: (partnerId: string) =>
    ["admin-partner-inventory", partnerId] as const,
  adminMarketplacePartners: ["admin-marketplace-partners"] as const,
  adminPartnerCompanyAddress: (partnerId: string) =>
    ["admin-partner-company-address", partnerId] as const,
  adminRwaRolesOverview: (chainId: number) =>
    ["admin-rwa-roles-overview", chainId] as const,
  adminRwaRolesStatus: (wallet: string, chainId: number) =>
    ["admin-rwa-roles-status", wallet.toLowerCase(), chainId] as const,
  /** @deprecated use adminRwaCards */
  adminListedRwaCards: (chainId: number) => ["admin-rwa-cards", chainId] as const,
  adminUserStats: () => ["admin-user-stats"] as const,
  adminAnalytics: (days: number, chainId: number) =>
    ["admin-analytics", days, chainId] as const,
  adminDataInventory: () => ["admin-data-inventory"] as const,
  adminGa4Analytics: (days: number) => ["admin-ga4-analytics", days] as const,
  adminUsersList: (
    q: string,
    filter: string,
    role: string,
    accountStatus: string,
    page: number,
    limit: number,
  ) =>
    ["admin-users-list", q, filter, role, accountStatus, page, limit] as const,
  adminUserDetail: (userId: string) => ["admin-user-detail", userId] as const,
  /** Admin — marketplace collections list (cursor pages). */
  adminCollectionsList: () => ["admin-collections-list"] as const,
  /**
   * Derived collection/bucket key computed from a token's metadata + tokenURI.
   * URI included so the key invalidates if the on-chain tokenURI is updated.
   */
  rwaBucketKey: (tokenId: number, uri: string | undefined) =>
    ["metadata-bucket-key", tokenId, uri] as const,
  /** On-chain trade activity events for a single token. */
  rwaActivity: (tokenId: number) => ["rwa-activity", tokenId] as const,
  /** Server-resolved collection_key for a minted/owned token (rwa_tokens + metadata). */
  tokenCollectionKey: (tokenId: number) => ["token-collection-key", tokenId] as const,
  /**
   * Batch server-resolved collection_key for a wallet's owned token set.
   * Keyed by (wallet address, sorted token IDs) so it fires in parallel with
   * the metadata batch — both only need tokenIds, not the full metadata payload.
   */
  tokenCollectionKeyBatch: (addr: string, tokenIds: readonly number[]) =>
    [
      "token-collection-key-batch",
      addr.toLowerCase(),
      [...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  /** Resolved https URL for the slab back-image (used in RWA detail panel). */
  rwaSlabBack: (uri: string) => ["rwa-detail-slab-back", uri] as const,

  // ── Merkle ─────────────────────────────────────────────────────────────────

  /** Merkle-eligible tokenIds for a specific collection (criteria bid flow). */
  merkleSet: (key: string) => ["merkle-set", key] as const,
  /** Prefix key used to invalidate ALL merkle-set queries at once. */
  merkleSetAll: () => ["merkle-set"] as const,

  // ── Portfolio ──────────────────────────────────────────────────────────────

  /** Daily portfolio value snapshots for a wallet (per active app chain). */
  portfolioDailySnapshots: (addr: string, chainId: number) =>
    ["portfolio-daily-snapshots", addr.trim().toLowerCase(), chainId] as const,
  /**
   * Market stats + series batch for portfolio holdings.
   * Collection keys are spread individually (not nested array) so React Query's
   * prefix invalidation via `["portfolio-market-batch"]` remains effective.
   * Keys are lowercased + sorted so the cache is wallet-agnostic and order-independent.
   * Call site must pre-compute `portfolioMarketBatchSig` and pass sorted keys.
   */
  portfolioMarketBatch: (chainId: number, collectionKeys: readonly string[]) =>
    [
      "portfolio-market-batch",
      chainId,
      ...collectionKeys.map((k) => k.toLowerCase()).sort(),
    ] as const,
  /** Token-level comps sparkline for holdings without a collection snapshot. */
  portfolioTokenSparklines: (chainId: number, tokenIds: readonly number[]) =>
    [
      "portfolio-token-sparklines",
      chainId,
      ...[...tokenIds].slice().sort((a, b) => a - b),
    ] as const,
  /**
   * Collection-key-to-tokenId resolution for the portfolio page.
   * `sig` is a stable derived string summarising the current set of owned assets
   * (token IDs + metadata components + listing keys). Named `portfolioBucketKeysSig`
   * at the call site. Required because this query has no external invalidation.
   */
  portfolioBucketKeys: (addr: string, sig: string) =>
    ["portfolio-bucket-keys", addr.toLowerCase(), sig] as const,

  // ── Media ──────────────────────────────────────────────────────────────────

  /** Single IPFS/arweave URI → resolved https URL. */
  mediaHttps: (uri: string) => ["media-https", uri] as const,
  /** Batch of resolved media URLs keyed by a stable batch-ID string. */
  mediaHttpsBatch: (batchKey: string) => ["media-https-batch", batchKey] as const,

  // ── Floor / Criteria bids ──────────────────────────────────────────────────

  /**
   * Metadata pack for floor-ask token candidates in the criteria bid flow.
   * `sortedTokenIdsSig` is a pre-sorted comma-joined token ID string
   * (e.g. `"123,456,789"`). Named `floorAskMetadataSig` at the call site.
   * Required because floor asks can change between renders and this query
   * has no external invalidation — the sig ensures immediate cache bypass.
   */
  floorAskMetadata: (collectionKey: string, sortedTokenIdsSig: string) =>
    ["floor-ask-metadata", collectionKey, sortedTokenIdsSig] as const,

  // ── Wallet / Chain ─────────────────────────────────────────────────────────

  /** ERC-20 token balance (USDC) for a wallet address (on-chain). */
  tokenBalance: (addr: string) => ["token-balance", addr] as const,
  /** RWA NFT balance count for a wallet address (on-chain). */
  rwaBalance: (addr: string) => ["rwa-balance", addr] as const,

  // ── CardHedger ─────────────────────────────────────────────────────────────

  /** List of available Top 100 categories (discovered daily from CardHedger). */
  cardhedgerTop100Categories: () => ["cardhedger-top100-categories"] as const,
  /** Cached daily Top 100 snapshot by category. */
  cardhedgerTop100: (category: string) =>
    ["cardhedger-top100", category] as const,
  /** Recent daily Top 100 snapshots for day-over-day comparison. */
  cardhedgerTop100History: (category: string, limit: number) =>
    ["cardhedger-top100-history", category, limit] as const,
  /** Cached top movers (weekly gain) by category — 1h server TTL. */
  cardhedgerTopMovers: (category: string, count: number) =>
    ["cardhedger-top-movers", category, count] as const,
  /** Single catalog cover resolve by search string. */
  cardhedgerCatalogCover: (search: string) =>
    ["cardhedger-catalog-cover", search] as const,
  cardhedgerCardDetails: (cardId: string) => ["cardhedger-card-details", cardId] as const,
  cardhedgerPricesByCard: (cardId: string, grade: string, days: number) =>
    ["cardhedger-prices-by-card", cardId, grade, days] as const,
  cardhedgerAllPricesByCard: (cardId: string) =>
    ["cardhedger-all-prices-by-card", cardId] as const,
  /** Grade-specific 90-day sales via 90day-prices-by-grade-search. */
  cardhedger90DaySalesByGrade: (cardId: string, grade: string, searchSig: string) =>
    ["cardhedger-90day-sales-by-grade", cardId, grade, searchSig] as const,
  /** Fallback 90-day sales via `90day-prices-by-grade` (not search API). */
  cardhedger90DaySalesFallback: (
    cardId: string,
    grade: string,
    category: string,
    description: string,
  ) =>
    [
      "cardhedger-90day-sales-fallback",
      cardId,
      grade,
      category,
      description,
    ] as const,
} as const;

/** Retry Nest API blips (dev hot-reload, brief proxy ECONNRESET). */
export function marketplaceApiRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 4000);
}

export const marketplaceRqPolicy = {
  // ── Existing policy values (do not remove) ─────────────────────────────────
  /** Active order book — same interval on every page */
  ordersRefetchMs: 30_000,
  ordersStaleMs: 15_000,
  /** Extra React Query retries for same-origin /api → Nest (on top of backendFetch retries). */
  apiQueryRetry: 2,
  collectionsStaleMs: 5 * 60_000,
  snapshotsStaleMs: 5 * 60_000,
  rwaTokensStaleMs: 60_000,
  metadataBatchStaleMs: 5 * 60_000,
  /** Cardhedger-backed queries (mint batch, portfolio batch, market-series) share this freshness window */
  /** Cardhedger catalog snapshots (top100, top-movers) — align with server 1h cache where applicable. */
  cardhedgerStaleMs: 60 * 60_000,
  /** Keep resolved Cardhedger payloads in memory while navigating (matches marketplace bundle gc pattern) */
  cardhedgerGcMs: 24 * 60 * 60 * 1000,

  // ── Expanded policy values ──────────────────────────────────────────────────
  /** Collection market price series (chart data) — 5 min is sufficient given Cardhedger update cadence */
  marketSeriesStaleMs: 5 * 60_000,
  /** Single collection detail (cover, components, listing count) */
  collectionDetailStaleMs: 60_000,
  /** Single RWA resolved asset (tokenURI + metadata) */
  metadataDetailStaleMs: 60_000,
  /** Merkle-eligible token set for criteria bids */
  merkleSetStaleMs: 20_000,
  /** Daily portfolio value snapshots */
  portfolioDailyStaleMs: 120_000,
  /** Resolved IPFS/arweave media URLs — effectively permanent once resolved */
  mediaStaleMs: 86_400_000,
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
  queryClient.setQueryDefaults(["portfolio-token-sparklines"], d);
  queryClient.setQueryDefaults(["collection-market-series"], d);
}
