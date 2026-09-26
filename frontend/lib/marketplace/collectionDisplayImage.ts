import { ASSETS } from "@/constants/assets";
import type { MarketplaceCollectionDetail, MarketplaceCollectionSummary } from "@/lib/core";
import { normalizeCatalogCoverPublicUrl } from "@/lib/marketplace/catalogCoverPublicUrl";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/** Bundled Tokenable default — same as mint slab fallback. */
export const COLLECTION_COVER_PLACEHOLDER_URL =
  ASSETS.icons.tokenableMintPlaceholder;

/** PSA graded slab photos must never be collection hero images. */
export function isPsaCertSlabCloudfrontUrl(url: string): boolean {
  return url.includes("d1htnxwo4o0jhw.cloudfront.net/cert/");
}

function isLegacyNormalizedCollectionCoverApiPath(
  url: string | null | undefined,
): boolean {
  const t = (url ?? "").trim();
  return /\/marketplace\/collections\/[^/?#]+\/cover-image\.jpg$/i.test(t);
}

function sanitizeCollectionCoverUrl(
  url: string | null | undefined,
): string | null {
  const t = url?.trim();
  if (!t) return null;
  if (isPsaCertSlabCloudfrontUrl(t)) return null;
  if (/\/rwa-slabs\//i.test(t)) return null;
  if (isLegacyNormalizedCollectionCoverApiPath(t)) return null;
  return normalizeCatalogCoverPublicUrl(t);
}

/**
 * Collection card / hero display image.
 * Uses cover_image_url (or API-resolved display/representative fields) only.
 */
export function pickCollectionDisplayImageUrl(input: {
  displayImageUrl?: string | null;
  representativeImageUrl?: string | null;
  coverImageUrl?: string | null;
  components?: Pick<CollectionComponents, "trendingSlabImageUrl"> | null;
  collectionKey?: string | null;
}): string {
  const fromApi = sanitizeCollectionCoverUrl(
    input.displayImageUrl?.trim() || input.representativeImageUrl?.trim() || null,
  );
  if (fromApi) return fromApi;

  const fromCover = sanitizeCollectionCoverUrl(
    input.coverImageUrl?.trim() || null,
  );
  if (fromCover) return fromCover;

  return COLLECTION_COVER_PLACEHOLDER_URL;
}

export function pickCollectionSummaryDisplayImageUrl(
  collection: MarketplaceCollectionSummary,
): string | null {
  return pickCollectionDisplayImageUrl({
    displayImageUrl: collection.displayImageUrl,
    coverImageUrl: collection.coverImageUrl,
    collectionKey: collection.collectionKey,
  });
}

export function pickCollectionDetailDisplayImageUrl(
  detail: Pick<MarketplaceCollectionDetail, "collection" | "representativeImageUrl">,
): string | null {
  return pickCollectionDisplayImageUrl({
    representativeImageUrl: detail.representativeImageUrl,
    coverImageUrl: detail.collection?.coverImageUrl,
    collectionKey: detail.collection?.collectionKey,
  });
}
