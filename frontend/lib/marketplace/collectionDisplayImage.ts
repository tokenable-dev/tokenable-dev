import type { MarketplaceCollectionDetail, MarketplaceCollectionSummary } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/** PSA graded slab photos must never be collection hero images. */
export function isPsaCertSlabCloudfrontUrl(url: string): boolean {
  return url.includes("d1htnxwo4o0jhw.cloudfront.net/cert/");
}

function sanitizeCollectionCoverUrl(
  url: string | null | undefined,
): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (isPsaCertSlabCloudfrontUrl(t)) return null;
  return t;
}

/**
 * Collection card / hero display image.
 * Matches backend `pickCollectionDisplayImageUrl`: persisted catalog cover only (spec / Cardhedger / TCG).
 * Never PSA cert slabs — not from `trendingSlabImageUrl`.
 */
export function pickCollectionDisplayImageUrl(input: {
  displayImageUrl?: string | null;
  representativeImageUrl?: string | null;
  coverImageUrl?: string | null;
  components?: Pick<CollectionComponents, "trendingSlabImageUrl"> | null;
}): string | null {
  const fromApi = sanitizeCollectionCoverUrl(
    input.displayImageUrl?.trim() || input.representativeImageUrl?.trim() || null,
  );
  if (fromApi) return fromApi;

  return sanitizeCollectionCoverUrl(input.coverImageUrl);
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
