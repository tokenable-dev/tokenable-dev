/**
 * Centralized React Query invalidation layer.
 *
 * Rule: ALL invalidateQueries calls must originate from this file.
 * Call sites import the appropriate scenario function; they do NOT construct
 * raw queryKey arrays for invalidation.
 *
 * Layers:
 *  - Atomic helpers (internal)  — single domain, single concern
 *  - Scenario functions (export) — composite invalidation for a user action
 */
import type { QueryClient } from "@tanstack/react-query";
import { clearPortfolioBundle } from "@/lib/portfolio/portfolioQueryPersistence";
import { rq } from "./queryKeys";

// ── Internal atomic helpers ────────────────────────────────────────────────
// Kept private so callers always use the semantic scenario functions below.

/** All `orders` cache entries (prefix covers every order sub-key). */
async function _invalidateOrdersAll(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["orders"] });
}

/** All `rwa-tokens` cache entries (prefix match — no address required). */
async function _invalidateRwaTokensAll(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["rwa-tokens"] });
}

/** All `rwa-metadata-batch` cache entries. */
async function _invalidateRwaMetadataBatch(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
}

/** All `cardhedger-mint-previews` cache entries. */
async function _invalidateMintPreviews(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["cardhedger-mint-previews"] });
}

/** All `collection-snapshots` cache entries (prefix). */
async function _invalidateCollectionSnapshots(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["collection-snapshots"] });
}

/** All `portfolio-market-batch` cache entries (prefix). */
async function _invalidatePortfolioMarketBatch(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["portfolio-market-batch"] });
}

/** Portfolio value chart (`GET …/portfolio/daily/:wallet`). Prefix when address unknown. */
async function _invalidatePortfolioDailySnapshots(
  qc: QueryClient,
  address?: string | null,
): Promise<void> {
  if (address?.trim()) {
    await qc.invalidateQueries({
      queryKey: ["portfolio-daily-snapshots", address.trim().toLowerCase()],
    });
    return;
  }
  await qc.invalidateQueries({ queryKey: ["portfolio-daily-snapshots"] });
}

/**
 * ALL `marketplace-collection` entries (1-element prefix — covers every collection).
 * Use only when the exact collection key is unknown or when all collections must refresh.
 */
async function _invalidateAllCollections(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["marketplace-collection"] });
}

// ── Public domain invalidators ─────────────────────────────────────────────
// These can be composed by scenario functions or called directly for simple cases.

/**
 * Invalidate all active orders.
 * The `["orders"]` prefix covers every order sub-key
 * (`ordersActive`, `orderByToken`, `orderDetail`, `ordersByTokenBatch`).
 */
export async function invalidateOrders(qc: QueryClient): Promise<void> {
  await _invalidateOrdersAll(qc);
}

/**
 * Invalidate a single RWA token's resolved asset metadata and activity feed.
 * Does NOT invalidate the wallet token list or batch metadata; use a scenario
 * function for that.
 */
export async function invalidateRwaAsset(
  qc: QueryClient,
  tokenId: number,
): Promise<void> {
  await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(tokenId) });
  await qc.invalidateQueries({ queryKey: rq.rwaActivity(tokenId) });
}

/**
 * Invalidate all data for a single collection
 * (detail, all market-series durations, platform trades, merkle set).
 * Also refreshes the global collections list.
 */
export async function invalidateCollection(
  qc: QueryClient,
  key: string,
): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  // Prefix covers every duration variant of collectionMarketSeries(key, *)
  await qc.invalidateQueries({ queryKey: ["collection-market-series", key] });
  await qc.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
  await qc.invalidateQueries({ queryKey: rq.merkleSet(key) });
  await qc.invalidateQueries({ queryKey: rq.merkleSetAll() });
  await qc.invalidateQueries({ queryKey: ["collections", "marketplace"] });
}

// ── Scenario invalidators (exported) ──────────────────────────────────────
// One function per distinct user action that requires cache invalidation.

/**
 * After a collection admin action (cover update, component change, etc.).
 *
 * Replaces: `useCollectionDetailInvalidation` (inline logic)
 */
export async function invalidateAfterCollectionUpdate(
  qc: QueryClient,
  key: string,
): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  await qc.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
  // Prefix — invalidates all cached durations for this collection's series
  await qc.invalidateQueries({ queryKey: ["collection-market-series", key] });
  await qc.invalidateQueries({ queryKey: rq.merkleSet(key) });
  await qc.invalidateQueries({ queryKey: rq.merkleSetAll() });
  await qc.invalidateQueries({ queryKey: ["collections", "marketplace"] });
}

/**
 * After a criteria bid is placed or cancelled for a collection.
 * Refreshes broader scope than a simple collection update because bids affect
 * order book state, RWA ownership, and all market series.
 *
 * Replaces: `invalidateCollectionCriteriaBidQueries`
 */
export async function invalidateAfterCriteriaBid(
  qc: QueryClient,
  key: string,
): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  await qc.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
  // Broad prefix — refreshes ALL collections' market series after a bid event
  await qc.invalidateQueries({ queryKey: ["collection-market-series"] });
  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: ["portfolio-bids"] });
  await qc.invalidateQueries({ queryKey: rq.merkleSetAll() });
  await qc.invalidateQueries({ queryKey: rq.merkleSet(key) });
  await _invalidateRwaTokensAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  // Invalidate on-chain readContract results (wagmi cache) for this collection
  await qc.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
  });
}

/**
 * After mint tx: refresh portfolio/token caches only (no collection bootstrap).
 */
export async function invalidateAfterRwaMintTx(
  qc: QueryClient,
  input: { tokenId: number; address?: string | null },
): Promise<void> {
  await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(input.tokenId) });
  await qc.invalidateQueries({ queryKey: rq.tokenCollectionKey(input.tokenId) });
  await _invalidateRwaTokensAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  await _invalidateMintPreviews(qc);
  await _invalidatePortfolioMarketBatch(qc);
  await _invalidatePortfolioDailySnapshots(qc, input.address);
  await qc.invalidateQueries({ queryKey: ["admin-custody-nfts"] });
  // Owned-token list must not stay frozen on localStorage / bootstrap cache.
  await qc.invalidateQueries({ queryKey: ["portfolio-assets-page-bootstrap"] });
  await qc.invalidateQueries({ queryKey: ["portfolio-assets-page"] });

  if (input.address?.trim()) {
    clearPortfolioBundle(input.address);
    await qc.invalidateQueries({ queryKey: ["rwa-tokens"] });
  }
}

/**
 * After mint bootstrap (legacy): refresh token lists, collection trades, and price snapshots.
 * @deprecated Collection is created on first listing — use {@link invalidateAfterRwaMintTx}.
 */
export async function invalidateAfterRwaMint(
  qc: QueryClient,
  input: { tokenId: number; collectionKey: string; address?: string | null },
): Promise<void> {
  const key = input.collectionKey.toLowerCase();

  await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(input.tokenId) });
  await qc.invalidateQueries({ queryKey: rq.tokenCollectionKey(input.tokenId) });
  await _invalidateRwaTokensAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  await _invalidateMintPreviews(qc);
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  await qc.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
  await _invalidateCollectionSnapshots(qc);
  await _invalidatePortfolioMarketBatch(qc);
  await qc.invalidateQueries({ queryKey: ["collections", "marketplace"] });

  if (input.address?.trim()) {
    await qc.invalidateQueries({ queryKey: ["rwa-tokens"] });
  }
}

/**
 * After a fulfillment, listing, or cancel on the RWA detail page.
 *
 * RWA detail buy/list flows — order, asset, collection market queries.
 */
export async function invalidateAfterRwaDetail(
  qc: QueryClient,
  input: { tokenId: number; collectionKeyForMatch: string | null },
): Promise<void> {
  const { tokenId, collectionKeyForMatch } = input;

  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: rq.orderByToken(tokenId) });
  await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(tokenId) });
  await qc.invalidateQueries({ queryKey: rq.rwaActivity(tokenId) });
  await qc.invalidateQueries({ queryKey: ["rwa-token-trades", tokenId] });
  await _invalidateRwaTokensAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  // Prefix — refreshes all cached collection entries (detail + market)
  await _invalidateAllCollections(qc);
  await _invalidatePortfolioDailySnapshots(qc);

  if (collectionKeyForMatch) {
    await qc.invalidateQueries({ queryKey: ["marketplace-collection", collectionKeyForMatch] });
    // Prefix — all durations for this collection
    await qc.invalidateQueries({ queryKey: ["collection-market-series", collectionKeyForMatch] });
    await qc.invalidateQueries({ queryKey: ["collection-platform-trades", collectionKeyForMatch] });
    await _invalidateCollectionSnapshots(qc);
    await _invalidatePortfolioMarketBatch(qc);
  }
}

/**
 * After a listing is created (post-match or instant match flow).
 * `collectionKey` and `address` are optional — provide when known.
 *
 * Replaces: `invalidateListingQueries` in `listRwaInstantMatch.ts`
 */
export async function invalidateAfterListing(
  qc: QueryClient,
  opts: {
    collectionKey?: string | null;
    address?: string | null;
    tokenId?: number;
  } = {},
): Promise<void> {
  await _invalidateOrdersAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  await _invalidateMintPreviews(qc);
  await qc.invalidateQueries({ queryKey: ["collections", "marketplace"] });
  await _invalidateCollectionSnapshots(qc);
  await _invalidatePortfolioDailySnapshots(qc, opts.address);
  // Broad prefix — all collection details (new listing changes market depth)
  await _invalidateAllCollections(qc);
  await qc.invalidateQueries({ queryKey: rq.merkleSetAll() });
  await qc.invalidateQueries({ queryKey: ["portfolio-activity"] });
  await qc.invalidateQueries({ queryKey: ["portfolio-bids"] });

  if (opts.tokenId != null && Number.isFinite(opts.tokenId) && opts.tokenId >= 0) {
    await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(opts.tokenId) });
    await qc.invalidateQueries({ queryKey: rq.tokenCollectionKey(opts.tokenId) });
  }

  if (opts.collectionKey) {
    const key = opts.collectionKey.toLowerCase();
    await qc.invalidateQueries({ queryKey: rq.merkleSet(key) });
    await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
    await qc.invalidateQueries({ queryKey: ["collection-platform-trades", key] });
  }
  if (opts.address) {
    await qc.invalidateQueries({ queryKey: ["rwa-tokens"] });
  }
}

/**
 * Marketplace notifications inbox (`rq.marketplaceNotifications`).
 * Pass `userId` when known; otherwise invalidate the whole prefix.
 */
export async function invalidateMarketplaceNotifications(
  qc: QueryClient,
  userId?: string | null,
  chainId?: number | null,
): Promise<void> {
  if (userId?.trim() && chainId != null) {
    await qc.invalidateQueries({
      queryKey: rq.marketplaceNotifications(userId.trim(), chainId),
    });
    return;
  }
  if (userId?.trim()) {
    await qc.invalidateQueries({
      queryKey: ["marketplace-notifications", userId.trim()],
    });
    return;
  }
  await qc.invalidateQueries({ queryKey: ["marketplace-notifications"] });
}

/**
 * After seller accept-offer settle (ask untouched until success; then book + inventory move).
 */
export async function invalidateAfterAcceptOffer(
  qc: QueryClient,
  opts: {
    collectionKey?: string | null;
    address?: string | null;
    tokenId?: number;
    userId?: string | null;
  },
): Promise<void> {
  await invalidateAfterListing(qc, opts);
  await qc.invalidateQueries({ queryKey: ["portfolio-bids"] });
  await invalidateMarketplaceNotifications(qc, opts.userId);
}

/**
 * After a dead token bid is invalidated (underfunded / expired).
 * Orders book + inbox so sellers stop seeing the dead offer.
 */
export async function invalidateAfterDeadBid(
  qc: QueryClient,
  userId?: string | null,
): Promise<void> {
  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: ["portfolio-bids"] });
  await invalidateMarketplaceNotifications(qc, userId);
}

/**
 * After an individual order (ask or criteria bid) is cancelled from the
 * owned-RWA list modal. Refreshes orders + the specific collection depth.
 */
export async function invalidateAfterOrderCancel(
  qc: QueryClient,
  collectionKey: string,
): Promise<void> {
  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
}

/**
 * After a new listing is created from the collection listing modal.
 * Refreshes orders, collection state (depth + merkle), and the owned-RWA
 * list for this specific wallet + collection so the modal re-renders.
 */
export async function invalidateAfterCollectionListing(
  qc: QueryClient,
  collectionKey: string,
  addr: string,
): Promise<void> {
  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
  await qc.invalidateQueries({ queryKey: rq.merkleSet(collectionKey) });
  await qc.invalidateQueries({
    queryKey: rq.collectionOwnedRwa(addr.toLowerCase(), collectionKey),
  });
}

/**
 * After a token is burned (transferred to the burn address).
 * Refreshes all wallet token lists, metadata batches, orders, and the
 * portfolio daily-value snapshot for the wallet.
 */
export async function invalidateAfterBurn(
  qc: QueryClient,
  address: string,
): Promise<void> {
  await _invalidateRwaTokensAll(qc);
  await _invalidateRwaMetadataBatch(qc);
  await _invalidateOrdersAll(qc);
  await qc.invalidateQueries({ queryKey: ["admin-rwa-cards"] });
  await qc.invalidateQueries({ queryKey: ["admin-custody-nfts"] });
  await _invalidatePortfolioDailySnapshots(qc, address);
}

/**
 * Targeted refresh between match-retry rounds in the instant-match flow.
 * Refreshes only the collection detail and merkle set — not the full listing scope.
 *
 * Replaces: inline invalidation blocks inside `listRwaInstantMatch.ts` retry loop
 * and `runPostListInstantMatch`.
 */
export async function invalidateForMatchRetry(
  qc: QueryClient,
  key: string,
): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["marketplace-collection", key] });
  await qc.invalidateQueries({ queryKey: rq.merkleSet(key) });
  await qc.invalidateQueries({ queryKey: rq.merkleSetAll() });
}
