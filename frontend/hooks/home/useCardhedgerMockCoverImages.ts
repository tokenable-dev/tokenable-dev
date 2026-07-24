"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { searchCardhedgerCards } from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import {
  normalizeCatalogCoverUrl,
  pickCardhedgerCatalogCoverUrl,
} from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import type { CardhedgerSearchCard } from "@/lib/core/api/cardhedger";

export type MockCoverSearchQuery = { key: string; search: string };

async function mapPool<T, R>(
  items: T[],
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
 * Resolve Bubble catalog covers (`/crop_image`) for mock cards via Cardhedger
 * card-search using each card's title + set — not random top-movers / eBay slabs.
 * Within one batch, each cover URL is assigned at most once.
 */
export function useCardhedgerMockCoverImages(
  enabled: boolean,
  queries: readonly MockCoverSearchQuery[],
) {
  const queryClient = useQueryClient();

  /** First-seen key order (matches grid order); no alpha-sort so uniqueness prefers earlier cards. */
  const stableQueries = useMemo(() => {
    const seen = new Set<string>();
    const out: MockCoverSearchQuery[] = [];
    for (const q of queries) {
      const key = q.key.trim().toLowerCase();
      const search = q.search.trim();
      if (!key || !search || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, search });
    }
    return out;
  }, [queries]);

  const sig = useMemo(
    () =>
      [...stableQueries]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((q) => `${q.key}:${q.search}`)
        .join("|"),
    [stableQueries],
  );

  return useQuery({
    queryKey: rq.cardhedgerMockCovers(sig),
    queryFn: async (): Promise<Map<string, string>> => {
      const fetched = await mapPool(
        stableQueries,
        4,
        async (
          q,
        ): Promise<{
          key: string;
          search: string;
          cards: CardhedgerSearchCard[];
        }> => {
          try {
            const { cards } = await searchCardhedgerCards({
              search: q.search,
              page: 1,
              page_size: 12,
            });
            return { key: q.key, search: q.search, cards };
          } catch {
            return { key: q.key, search: q.search, cards: [] };
          }
        },
      );

      const usedUrls = new Set<string>();
      const map = new Map<string, string>();
      for (const row of fetched) {
        const url = pickCardhedgerCatalogCoverUrl(row.cards, {
          excludeUrls: usedUrls,
        });
        if (!url) continue;
        usedUrls.add(normalizeCatalogCoverUrl(url));
        map.set(row.key, url);
        queryClient.setQueryData(rq.cardhedgerCatalogCover(row.search), url);
      }
      return map;
    },
    enabled: enabled && stableQueries.length > 0,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
  });
}
