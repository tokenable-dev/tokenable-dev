/**
 * Home hero 3D ring face textures — `public/assets/home/newcards/`.
 * Not marketplace/S3 covers.
 */
export const HERO_LANDING_IMAGE_URLS = [
  "/assets/home/newcards/c01.jpg",
  "/assets/home/newcards/c02.jpg",
  "/assets/home/newcards/c03.jpg",
  "/assets/home/newcards/c04.jpg",
  "/assets/home/newcards/c05.jpg",
  "/assets/home/newcards/c06.jpg",
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
