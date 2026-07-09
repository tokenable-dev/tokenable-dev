import type { HeroCarouselTier } from "@/lib/home/heroCarouselCapability";
import { HERO_SLAB_CAROUSEL_SOURCES } from "@/lib/home/heroCarouselAssets";

/** Warm browser cache before WebGL TextureLoader runs (Phase 2). */
export function preloadHeroCarouselImages(
  tier: HeroCarouselTier,
  timeoutMs = 12_000,
): Promise<void> {
  if (tier === "fallback") return Promise.resolve();

  const count = tier === "reduced" ? 6 : 10;
  const urls = new Set<string>();
  for (let i = 0; i < count; i++) {
    const src = HERO_SLAB_CAROUSEL_SOURCES[i % HERO_SLAB_CAROUSEL_SOURCES.length];
    if (src) urls.add(src);
  }

  const loads = [...urls].map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        const done = () => resolve();
        img.onload = done;
        img.onerror = done;
        img.src = url;
      }),
  );

  return Promise.race([
    Promise.all(loads).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}
