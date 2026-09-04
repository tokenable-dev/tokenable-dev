import { backendFetch, getApiUrl } from "./client";
import type { Order } from "./orders";
import type { CollectionListMarketSnapshot } from "./marketplace-market-data";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export type CollectionReviewStatus =
  | "pending_review"
  | "active"
  | "rejected";

export type CollectionReviewStatusFilter = CollectionReviewStatus | "all";

export interface MarketplaceCollectionSummary {
  collectionKey: string;
  displayLabel: string;
  queryUsed: string | null;
  components: CollectionComponents;
  createdAt: string;
  activeListingCount: number;
  /** Persisted catalog cover (admin-editable). */
  coverImageUrl?: string | null;
  /** UI image: persisted catalog cover only (PSA spec / Cardhedger — never cert slab). */
  displayImageUrl?: string | null;
  /** Markets visibility gate. Public lists only return `active`. */
  reviewStatus?: CollectionReviewStatus;
}

export interface MarketplaceSearchCardHit {
  tokenId: string;
  certNumber: string | null;
  collectionKey: string | null;
  title: string;
  setLine: string | null;
  gradeLabel: string | null;
  vaultLabel: string;
  listedUsd: number | null;
  imageUrl: string | null;
  /** Present when the token is in a catalog bucket — used for Line 1 / Line 2. */
  components?: CollectionComponents | null;
}

export async function getMarketplaceSearch(opts: {
  q: string;
  cardLimit?: number;
  collectionLimit?: number;
}): Promise<{
  cards: MarketplaceSearchCardHit[];
  collections: MarketplaceCollectionSummary[];
}> {
  const sp = new URLSearchParams();
  const q = opts.q.trim();
  if (!q) return { cards: [], collections: [] };
  sp.set("q", q);
  if (opts.cardLimit != null) sp.set("cardLimit", String(opts.cardLimit));
  if (opts.collectionLimit != null) {
    sp.set("collectionLimit", String(opts.collectionLimit));
  }
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/search?${sp.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to search catalog");
  const body = (await res.json().catch(() => null)) as {
    cards?: MarketplaceSearchCardHit[];
    collections?: MarketplaceCollectionSummary[];
  } | null;
  return {
    cards: Array.isArray(body?.cards) ? body.cards.filter(Boolean) : [],
    collections: Array.isArray(body?.collections)
      ? body.collections.filter(Boolean)
      : [],
  };
}

/** Graded metadata-based collection summaries (cursor pagination or `q` search). */
export async function getMarketplaceCollectionsPage(opts?: {
  cursor?: string | null;
  limit?: number;
  /** Server-side text search; when set, cursor is ignored. */
  q?: string | null;
  /** Admin session required for non-`active` values. */
  reviewStatus?: CollectionReviewStatusFilter;
}): Promise<{
  items: MarketplaceCollectionSummary[];
  nextCursor: string | null;
}> {
  const sp = new URLSearchParams();
  if (opts?.cursor) sp.set("cursor", opts.cursor);
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  if (opts?.q?.trim()) sp.set("q", opts.q.trim());
  if (opts?.reviewStatus) sp.set("reviewStatus", opts.reviewStatus);
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections${q ? `?${q}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch collections");
  const body = (await res.json().catch(() => null)) as {
    items?: MarketplaceCollectionSummary[];
    nextCursor?: string | null;
  } | null;
  return {
    items: Array.isArray(body?.items) ? body.items.filter(Boolean) : [],
    nextCursor: body?.nextCursor ?? null,
  };
}

/** Card.html Similar items — same card name OR same set (excludes `collectionKey`). */
export async function getMarketplaceCollectionSimilar(
  collectionKey: string,
): Promise<{ items: MarketplaceCollectionSummary[] }> {
  const key = encodeURIComponent(collectionKey.trim());
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${key}/similar`,
  );
  if (!res.ok) throw new Error("Failed to fetch similar collections");
  return res.json() as Promise<{ items: MarketplaceCollectionSummary[] }>;
}

export async function getAdminCollectionReviewCounts(): Promise<
  Record<CollectionReviewStatus, number>
> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/admin/review-counts`,
  );
  if (!res.ok) throw new Error("Failed to fetch review counts");
  return res.json() as Promise<Record<CollectionReviewStatus, number>>;
}

export type AdminCatalogCollectionCreateResult = {
  collectionKey: string;
  created: boolean;
  displayLabel: string;
  reviewStatus: CollectionReviewStatus;
  coverImageUrl: string | null;
  psaCertNumber: string | null;
};

/** Admin: create collection from PSA cert (no mint / ask required). */
export async function postAdminCreateCatalogCollectionFromCert(body: {
  certNumber: string;
}): Promise<AdminCatalogCollectionCreateResult> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/admin/create-from-cert`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string | string[] }).message;
    throw new Error(
      Array.isArray(msg)
        ? msg.join(", ")
        : (msg ?? "Failed to create collection from PSA cert"),
    );
  }
  return res.json() as Promise<AdminCatalogCollectionCreateResult>;
}

export async function postAdminSetCollectionReviewStatus(
  collectionKey: string,
  body: { reviewStatus: CollectionReviewStatus },
): Promise<{ collectionKey: string; reviewStatus: CollectionReviewStatus }> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/admin/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to update review status",
    );
  }
  return res.json() as Promise<{
    collectionKey: string;
    reviewStatus: CollectionReviewStatus;
  }>;
}

const ALL_COLLECTIONS_PAGE_LIMIT = 60;
const ALL_COLLECTIONS_MAX_PAGES = 100;

/** Walk cursor pages until exhausted — for home ranking across the full catalog. */
export async function getAllMarketplaceCollections(): Promise<
  MarketplaceCollectionSummary[]
> {
  const items: MarketplaceCollectionSummary[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < ALL_COLLECTIONS_MAX_PAGES; page++) {
    const pack = await getMarketplaceCollectionsPage({
      cursor,
      limit: ALL_COLLECTIONS_PAGE_LIMIT,
    });
    items.push(...pack.items);
    cursor = pack.nextCursor;
    if (!cursor) break;
  }
  return items;
}

export interface HomeMarketplaceFeed {
  topMovers: MarketplaceCollectionSummary[];
  justVaulted: MarketplaceCollectionSummary[];
  ticker: MarketplaceCollectionSummary[];
  snapshots: CollectionListMarketSnapshot[];
}

export async function getHomeMarketplaceFeed(): Promise<HomeMarketplaceFeed> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/home-feed`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load home feed",
    );
  }
  return res.json() as Promise<HomeMarketplaceFeed>;
}

export interface MarketplaceCollectionDetail {
  /** Null until first listing (or other flow) creates `marketplace_collections` for this key. */
  collection: {
    collectionKey: string;
    displayLabel: string;
    queryUsed: string | null;
    components: CollectionComponents;
    createdAt: string;
    /** Persisted cover; stable once set. Prefer this over recomputed fallback in UI when present. */
    coverImageUrl?: string | null;
    reviewStatus?: CollectionReviewStatus;
  } | null;
  listings: Order[];
  /** ERC721_WITH_CRITERIA collection bids */
  collectionBids: Order[];
  /** UI display image: catalog cover or slab fallback (same as list `displayImageUrl`). */
  representativeImageUrl: string | null;
}

export async function getMarketplaceCollectionDetail(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<MarketplaceCollectionDetail> {
  const enc = encodeURIComponent(collectionKey);
  const qs = opts?.bypassCache ? `?nocache=${Date.now()}` : "";
  const res = await backendFetch(`${getApiUrl()}/marketplace/collections/${enc}${qs}`, {
    ...(opts?.bypassCache ? { cache: "no-store" as RequestCache } : {}),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection"
    );
  }
  return res.json() as Promise<MarketplaceCollectionDetail>;
}

/**
 * Same payload as {@link getMarketplaceCollectionDetail} but returns `null` when the bucket has no
 * `marketplace_collections` row yet (`collection` is null). HTTP is always 200 from the detail endpoint.
 */
export async function getMarketplaceCollectionDetailOrNull(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<MarketplaceCollectionDetail | null> {
  const d = await getMarketplaceCollectionDetail(collectionKey, opts);
  return d.collection ? d : null;
}

/** Admin: persist collection cover (requires admin session cookie). */
export async function postAdminSetCollectionCover(
  collectionKey: string,
  body: { coverImageUrl: string },
): Promise<{ collectionKey: string; coverImageUrl: string | null }> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/admin/cover`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to set collection cover",
    );
  }
  return res.json() as Promise<{ collectionKey: string; coverImageUrl: string | null }>;
}

/** Admin: upload local image to S3 and persist as collection cover. */
export async function postAdminUploadCollectionCover(
  collectionKey: string,
  file: File,
): Promise<{ collectionKey: string; coverImageUrl: string | null }> {
  const enc = encodeURIComponent(collectionKey);
  const body = new FormData();
  body.append("file", file);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/admin/cover/upload`,
    {
      method: "POST",
      body,
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { message?: string | string[] }).message;
    throw new Error(
      Array.isArray(message)
        ? message.join(", ")
        : (message ?? "Failed to upload collection cover"),
    );
  }
  return res.json() as Promise<{ collectionKey: string; coverImageUrl: string | null }>;
}

/** Admin: resolve cover from token metadata; `save: true` persists. */
export async function postAdminCollectionCoverFromToken(
  collectionKey: string,
  body: { tokenId: string; save?: boolean },
): Promise<{ coverImageUrl: string | null; saved: boolean }> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/admin/cover/from-token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to resolve cover from token",
    );
  }
  return res.json() as Promise<{ coverImageUrl: string | null; saved: boolean }>;
}

/** Admin: delete collection bucket (orders + snapshots). Keeps rwa_tokens. */
export async function postAdminDeleteCollection(
  collectionKey: string,
  body: { confirmCollectionKey: string },
): Promise<{
  collectionKey: string;
  deletedSnapshots: number;
  deletedOrders: number;
  unlinkedRwaTokens: number;
  deletedCollection: boolean;
}> {
  const enc = encodeURIComponent(collectionKey);
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${enc}/admin/delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to delete collection",
    );
  }
  return res.json() as Promise<{
    collectionKey: string;
    deletedSnapshots: number;
    deletedOrders: number;
    unlinkedRwaTokens: number;
    deletedCollection: boolean;
  }>;
}

/** Merkle leaf set — minted RWAs in this collection bucket (server metadata scan) */
export async function getMerkleEligibleTokenIds(
  collectionKey: string,
  opts?: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<{ tokenIds: string[] }> {
  const sp = new URLSearchParams();
  if (opts?.bypassCache) sp.set("bypassCache", "1");
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${encodeURIComponent(collectionKey)}/merkle-set${q ? `?${q}` : ""}`,
    { signal: opts?.signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load merkle set"
    );
  }
  return res.json() as Promise<{ tokenIds: string[] }>;
}

/** Minted / previously traded token ids — for card bids when there is no live ask. */
export async function getCollectionBidAnchorTokenIds(
  collectionKey: string,
  opts?: { signal?: AbortSignal },
): Promise<{ tokenIds: string[] }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections/${encodeURIComponent(collectionKey)}/bid-anchor-tokens`,
    { signal: opts?.signal },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load collection tokens"
    );
  }
  return res.json() as Promise<{ tokenIds: string[] }>;
}
