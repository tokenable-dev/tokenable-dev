import type { MarketplaceCollectionSummary } from "@/lib/core";

/** Title+set search string for catalog cover lookup (list + collection detail). */
export type CatalogCoverSearchInput = {
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

export function catalogCoverSearchFromCollection(
  c: CatalogCoverSearchInput | MarketplaceCollectionSummary,
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
