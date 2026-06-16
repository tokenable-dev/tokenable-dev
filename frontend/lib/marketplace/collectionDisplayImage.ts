import type { MarketplaceCollectionDetail, MarketplaceCollectionSummary } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/**
 * Collection card / hero display image.
 * Matches backend `pickCollectionDisplayImageUrl`: persisted catalog cover, then slab fallback.
 */
export function pickCollectionDisplayImageUrl(input: {
  displayImageUrl?: string | null;
  representativeImageUrl?: string | null;
  coverImageUrl?: string | null;
  components?: Pick<CollectionComponents, "trendingSlabImageUrl"> | null;
}): string | null {
  const fromApi =
    input.displayImageUrl?.trim() || input.representativeImageUrl?.trim();
  if (fromApi) return fromApi;

  const cover = input.coverImageUrl?.trim();
  if (cover) return cover;

  const slab = input.components?.trendingSlabImageUrl?.trim();
  return slab || null;
}

export function pickCollectionSummaryDisplayImageUrl(
  collection: MarketplaceCollectionSummary,
): string | null {
  return pickCollectionDisplayImageUrl({
    displayImageUrl: collection.displayImageUrl,
    coverImageUrl: collection.coverImageUrl,
    components: collection.components,
  });
}

export function pickCollectionDetailDisplayImageUrl(
  detail: Pick<MarketplaceCollectionDetail, "collection" | "representativeImageUrl">,
): string | null {
  return pickCollectionDisplayImageUrl({
    representativeImageUrl: detail.representativeImageUrl,
    coverImageUrl: detail.collection?.coverImageUrl,
    components: detail.collection?.components,
  });
}
