import type { MarketplaceCollectionSummary } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains/activeChain";
import type { SupportedChainId } from "@/lib/chains/types";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";

const STORAGE_KEY = "tokenable.collectionBrowse.v2";
const MAX_AGE_MS = 30 * 60 * 1000;

export type CollectionBrowseEntry = {
  collectionKey: string;
  imageUrl: string;
  title?: string;
};

export type CollectionBrowseContext = {
  chainId: SupportedChainId;
  source: "markets-grid" | "markets-trending";
  entries: CollectionBrowseEntry[];
  categoryFilter?: string;
  sortId?: string;
  savedAt: number;
};

export function clearCollectionBrowseContext(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("tokenable.collectionBrowse.v1");
  } catch {
    /* ignore */
  }
}

export function buildBrowseEntriesFromSummaries(
  collections: MarketplaceCollectionSummary[],
): CollectionBrowseEntry[] {
  const out: CollectionBrowseEntry[] = [];
  for (const c of collections) {
    const imageUrl = pickCollectionSummaryDisplayImageUrl(c);
    if (!imageUrl || !c.collectionKey) continue;
    out.push({
      collectionKey: c.collectionKey,
      imageUrl,
      title: buildMarketsCollectionTitle({ collection: c, comp: c.components }),
    });
  }
  return out;
}

export function saveCollectionBrowseContext(
  ctx: Omit<CollectionBrowseContext, "savedAt" | "chainId"> & {
    chainId?: SupportedChainId;
  },
): void {
  if (typeof window === "undefined") return;
  if (ctx.entries.length < 2) return;
  const chainId = ctx.chainId ?? (activeRqChainId() as SupportedChainId);
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...ctx,
        chainId,
        savedAt: Date.now(),
      } satisfies CollectionBrowseContext),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readCollectionBrowseContext(
  expectedChainId?: number,
): CollectionBrowseContext | null {
  if (typeof window === "undefined") return null;
  const chainId = expectedChainId ?? activeRqChainId();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CollectionBrowseContext;
    if (
      !parsed?.entries?.length ||
      Date.now() - parsed.savedAt > MAX_AGE_MS ||
      parsed.chainId !== chainId
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Canonical marketplace listing URL (collection detail, optional copy focus). */
export function collectionDetailHref(
  collectionKey: string,
  opts?: { listingTokenId?: string | number | null; checkout?: string | null },
): string {
  const base = `/marketplace/collections/${encodeURIComponent(collectionKey)}`;
  const qs = new URLSearchParams();
  const tid =
    opts?.listingTokenId != null ? String(opts.listingTokenId).trim() : "";
  if (tid && tid !== "0") qs.set("listing", tid);
  const checkout = opts?.checkout?.trim();
  if (checkout) qs.set("checkout", checkout);
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

/**
 * Prefer known collectionKey; otherwise resolve via mint registry.
 * Falls back to `/markets` when the token has no bucket.
 */
export async function resolveCollectionDetailHref(
  tokenId: string | number,
  collectionKey?: string | null,
): Promise<string> {
  const key = collectionKey?.trim();
  if (key) return collectionDetailHref(key, { listingTokenId: tokenId });

  const idNum = Number(tokenId);
  if (!Number.isFinite(idNum) || idNum < 0) return "/markets";

  const { postTokenCollectionKeysByTokenIds } = await import("@/lib/core");
  const map = await postTokenCollectionKeysByTokenIds([idNum]);
  const resolved = map[idNum]?.trim();
  if (resolved) return collectionDetailHref(resolved, { listingTokenId: tokenId });
  return "/markets";
}
