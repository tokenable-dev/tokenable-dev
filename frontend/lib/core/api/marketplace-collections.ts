import { backendFetch, getApiUrl } from "./client";
import type { Order } from "./orders";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

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
}

/** Graded metadata-based collection summaries (cursor pagination). */
export async function getMarketplaceCollectionsPage(opts?: {
  cursor?: string | null;
  limit?: number;
}): Promise<{
  items: MarketplaceCollectionSummary[];
  nextCursor: string | null;
}> {
  const sp = new URLSearchParams();
  if (opts?.cursor) sp.set("cursor", opts.cursor);
  if (opts?.limit != null) sp.set("limit", String(opts.limit));
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/collections${q ? `?${q}` : ""}`,
  );
  if (!res.ok) throw new Error("Failed to fetch collections");
  return res.json() as Promise<{
    items: MarketplaceCollectionSummary[];
    nextCursor: string | null;
  }>;
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

/** Admin: persist collection cover (requires admin wallet in body). */
export async function postAdminSetCollectionCover(
  collectionKey: string,
  body: { adminWallet: string; coverImageUrl: string },
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

/** Admin: resolve cover from token metadata; `save: true` persists. */
export async function postAdminCollectionCoverFromToken(
  collectionKey: string,
  body: { adminWallet: string; tokenId: string; save?: boolean },
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

/** Admin: delete collection bucket and related marketplace rows. */
export async function postAdminDeleteCollection(
  collectionKey: string,
  body: { adminWallet: string; confirmCollectionKey: string },
): Promise<{
  collectionKey: string;
  deletedSnapshots: number;
  deletedOrders: number;
  deletedRwaTokens: number;
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
    deletedRwaTokens: number;
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
