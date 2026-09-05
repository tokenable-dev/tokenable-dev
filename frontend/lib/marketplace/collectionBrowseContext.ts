import type { MarketplaceCollectionSummary } from "@/lib/core";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";

const STORAGE_KEY = "tokenable.collectionBrowse.v1";
const MAX_AGE_MS = 30 * 60 * 1000;

export type CollectionBrowseEntry = {
  collectionKey: string;
  imageUrl: string;
  title?: string;
};

export type CollectionBrowseContext = {
  source: "markets-grid" | "markets-trending";
  entries: CollectionBrowseEntry[];
  categoryFilter?: string;
  sortId?: string;
  savedAt: number;
};

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

export function saveCollectionBrowseContext(ctx: Omit<CollectionBrowseContext, "savedAt">): void {
  if (typeof window === "undefined") return;
  if (ctx.entries.length < 2) return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...ctx, savedAt: Date.now() } satisfies CollectionBrowseContext),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readCollectionBrowseContext(): CollectionBrowseContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CollectionBrowseContext;
    if (!parsed?.entries?.length || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function collectionDetailHref(collectionKey: string): string {
  return `/marketplace/collections/${encodeURIComponent(collectionKey)}`;
}
