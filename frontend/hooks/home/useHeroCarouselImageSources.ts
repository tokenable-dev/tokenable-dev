"use client";

import { useQuery } from "@tanstack/react-query";
import { searchCardhedgerCards } from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import {
  normalizeCatalogCoverUrl,
  pickCardhedgerCatalogCoverUrl,
} from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import { HERO_CAROUSEL_SEARCHES } from "@/lib/home/heroCarouselAssets";
import type { CardhedgerSearchCard } from "@/lib/core/api/cardhedger";

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

/**
 * Unique Cardhedger Bubble catalog covers for the home hero ring.
 * Expansion / load filtering happens at boot time (preload).
 */
export function useHeroCarouselImageSources() {
  return useQuery({
    queryKey: rq.cardhedgerHeroCarousel(),
    queryFn: async (): Promise<string[]> => {
      const batches = await mapPool(
        HERO_CAROUSEL_SEARCHES,
        3,
        async (search): Promise<CardhedgerSearchCard[]> => {
          try {
            const { cards } = await searchCardhedgerCards({
              search,
              page: 1,
              page_size: 12,
            });
            return cards;
          } catch {
            return [];
          }
        },
      );

      const used = new Set<string>();
      const unique: string[] = [];
      for (const cards of batches) {
        const url = pickCardhedgerCatalogCoverUrl(cards, { excludeUrls: used });
        if (!url) continue;
        used.add(normalizeCatalogCoverUrl(url));
        unique.push(url);
      }
      return unique;
    },
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
  });
}
