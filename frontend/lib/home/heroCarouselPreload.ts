import type { HeroCarouselTier } from "@/lib/home/heroCarouselCapability";
import { cardCountForTier } from "@/lib/home/heroCarouselCapability";
import { expandHeroCarouselSources } from "@/lib/home/heroCarouselAssets";

function loadImageUrl(url: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => finish(url);
    img.onerror = () => finish(null);
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

/**
 * Warm cache and return only URLs that decode successfully.
 * Failed / CORS-blocked covers are dropped so the WebGL ring never shows
 * Tokenable placeholder slabs.
 */
export async function preloadHeroCarouselImages(
  tier: HeroCarouselTier,
  candidateUrls: readonly string[],
  timeoutMs = 12_000,
): Promise<string[]> {
  if (tier === "fallback" || candidateUrls.length === 0) return [];

  const uniqueCandidates = [...new Set(candidateUrls.map((u) => u.trim()).filter(Boolean))];
  const perImageTimeout = Math.min(8_000, timeoutMs);

  const loaded = (
    await Promise.all(
      uniqueCandidates.map((url) => loadImageUrl(url, perImageTimeout)),
    )
  ).filter((u): u is string => Boolean(u));

  const slotCount = cardCountForTier(tier);
  return expandHeroCarouselSources(loaded, slotCount);
}
