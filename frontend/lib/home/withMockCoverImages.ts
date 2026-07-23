import type { MarketplaceCollectionSummary } from "@/lib/core";

/** Overlay Cardhedger cover URLs onto mock cards by collection key (keeps titles/prices). */
export function withMockCoverImages(
  collections: MarketplaceCollectionSummary[],
  coverByKey: ReadonlyMap<string, string>,
): MarketplaceCollectionSummary[] {
  if (coverByKey.size === 0) return collections;
  return collections.map((c) => {
    const url = coverByKey.get(c.collectionKey.toLowerCase());
    if (!url) return c;
    return {
      ...c,
      coverImageUrl: url,
      displayImageUrl: url,
    };
  });
}

/** Same title+set search used for list covers and collection-detail fallback. */
export type MockCoverSearchInput = {
  collectionKey: string;
  displayLabel?: string | null;
  components?: {
    listingDisplayTitle?: string | null;
    cardNameDisplay?: string | null;
    cardName?: string | null;
    cardSetDisplay?: string | null;
    cardSet?: string | null;
  } | null;
};

export function mockCoverSearchFromCollection(
  c: MockCoverSearchInput | MarketplaceCollectionSummary,
): { key: string; search: string } {
  const title =
    c.components?.listingDisplayTitle?.trim() ||
    c.components?.cardNameDisplay?.trim() ||
    c.components?.cardName?.trim() ||
    c.displayLabel?.trim() ||
    "";
  const set =
    c.components?.cardSetDisplay?.trim() || c.components?.cardSet?.trim() || "";
  return {
    key: c.collectionKey.toLowerCase(),
    search: [title, set].filter(Boolean).join(" ").trim(),
  };
}
