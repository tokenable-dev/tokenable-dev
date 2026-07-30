/**
 * Home hero 3D ring face textures — static curated cards in `public/assets/home/`.
 * Not marketplace/S3 covers.
 */
export const HERO_LANDING_IMAGE_URLS = [
  "/assets/home/landing_1.jpg",
  "/assets/home/landing_2.jpg",
  "/assets/home/landing_3.jpg",
  "/assets/home/landing_4.jpg",
  "/assets/home/landing_5.jpg",
  "/assets/home/landing_6.jpg",
] as const;

export const HERO_SLAB_CAROUSEL_SLOT_COUNT = 10;

/**
 * Build face list for the ring from unique sources.
 * Prefer distinct covers; pad by repeating when we have enough unique faces.
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
