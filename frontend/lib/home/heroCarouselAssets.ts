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
 * **S3 / CloudFront catalog covers only** (via same-origin proxy).
 * Bubble `/crop_image` and `/resize` are skipped — WebGL TextureLoader needs
 * CORS (`crossOrigin=anonymous`) and Bubble CDN does not allow it.
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
  const used = new Set<string>();

  for (const collection of sorted) {
    const raw = pickCollectionSummaryDisplayImageUrl(collection);
    const url = normalizeCatalogCoverPublicUrl(raw) ?? raw;
    if (!url || !isCatalogCoverS3Url(url)) continue;
    const key = url.trim().toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    s3Urls.push(toSameOriginCatalogCoverUrl(url));
    if (s3Urls.length >= maxUnique) break;
  }

  return s3Urls;
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
