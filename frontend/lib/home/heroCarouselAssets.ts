/**
 * Hero carousel face queries — resolved via Cardhedger card-search → Bubble `/crop_image`.
 * Extra queries give more unique covers when some searches miss or fail CORS preload.
 */
export const HERO_CAROUSEL_SEARCHES = [
  "Charizard Base Set Holo 1st Edition",
  "LeBron James 2003 Topps Chrome Rookie Refractor",
  "Pikachu ex Surging Sparks",
  "Luka Doncic 2018 Prizm Blue Ice",
  "Nidoking ex Destined Rivals Stellar Rare",
  "Pikachu Special Art Rare Mega Dream",
  "Michael Jordan 1986 Fleer Rookie",
  "Umbreon VMAX Alternate Art",
  "Stephen Curry 2009 Topps Chrome Rookie",
  "Mew ex 151 Special Illustration Rare",
] as const;

export const HERO_SLAB_CAROUSEL_SLOT_COUNT = 10;

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
