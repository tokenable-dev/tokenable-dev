"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getTop100,
  getTop100Categories,
  TOP100_CATEGORIES,
  type PriceByGradeCard,
} from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";

export type Top100Item = PriceByGradeCard & {
  rank: number;
  priceNum: number | null;
};

function toItems(cards: PriceByGradeCard[]): Top100Item[] {
  return cards.map((c, idx) => ({
    ...c,
    rank: idx + 1,
    priceNum: c.price != null ? parseFloat(c.price) : null,
  }));
}

/** Fetches the list of available categories from the backend. Falls back to the seed list. */
export function useTop100Categories() {
  return useQuery({
    queryKey: rq.cardhedgerTop100Categories(),
    queryFn: getTop100Categories,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    placeholderData: {
      categories: [...TOP100_CATEGORIES],
      discoveredAt: null,
      source: "fallback" as const,
    },
    select: (data) => data.categories,
  });
}

export function useTop100(category: string) {
  return useQuery({
    queryKey: rq.cardhedgerTop100(category),
    queryFn: () => getTop100(category),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    select: (data) => ({
      items: toItems(data.cards),
      totalPages: data.totalPages,
      fetchedAt: data.fetchedAt,
      stale: data.stale,
      snapshotDate: data.snapshotDate ?? null,
      grade: data.grade,
      category: data.category,
    }),
  });
}

/** Convenience alias for Pokemon */
export function usePokemonTop100() {
  return useTop100("Pokemon");
}
