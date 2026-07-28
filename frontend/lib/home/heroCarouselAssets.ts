import type { MarketplaceCollectionSummary } from "@/lib/core";
import {
  isCatalogCoverS3Url,
  normalizeCatalogCoverPublicUrl,
  toSameOriginCatalogCoverUrl,
} from "@/lib/marketplace/catalogCoverPublicUrl";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";

/**
 * Hero carousel face textures come from marketplace collection covers
 * (S3 / CloudFront `coverImageUrl`), not live Cardhedger search.
 */
export const HERO_SLAB_CAROUSEL_SLOT_COUNT = 10;

const HERO_CAROUSEL_MAX_CANDIDATES = 20;

/**
 * Unique collection cover URLs for the home hero ring.
 * Prefers S3/catalog covers; newest collections first for variety.
 * Returns same-origin proxy URLs so WebGL preload succeeds without S3 CORS.
 */
export function pickHeroCarouselCoverUrls(
  collections: readonly MarketplaceCollectionSummary[],
  maxUnique = HERO_CAROUSEL_MAX_CANDIDATES,
): string[] {
  if (!collections.length || maxUnique <= 0) return [];

  const sorted = [...collections].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const s3Urls: string[] = [];
  const otherUrls: string[] = [];
  const used = new Set<string>();

  for (const collection of sorted) {
    const raw = pickCollectionSummaryDisplayImageUrl(collection);
    const url = normalizeCatalogCoverPublicUrl(raw) ?? raw;
    if (!url) continue;
    const key = url.trim().toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    if (isCatalogCoverS3Url(url)) s3Urls.push(toSameOriginCatalogCoverUrl(url));
    else otherUrls.push(url);
  }

  return [...s3Urls, ...otherUrls].slice(0, maxUnique);
}

/**
 * Build face list for the ring from URLs that actually resolved.
 * Prefer distinct covers; only pad by repeating when we have enough unique faces.
 */
export function expandHeroCarouselSources(
  uniqueUrls: readonly string[],
  slotCount = HERO_SLAB_CAROUSEL_SLOT_COUNT,
): string[] {
  if (!uniqueUrls.length || slotCount <= 0) return [];
  if (uniqueUrls.length >= slotCount) {
    return uniqueUrls.slice(0, slotCount);
  }
  // Fewer than 3 distinct — show only real unique cards (no Tokenable placeholder pads).
  if (uniqueUrls.length < 3) {
    return [...uniqueUrls];
  }
  return Array.from(
    { length: slotCount },
    (_, i) => uniqueUrls[i % uniqueUrls.length]!,
  );
}
