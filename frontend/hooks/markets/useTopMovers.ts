"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getTopMovers,
  type TopMoverCard,
} from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import { parseTop100Price } from "@/lib/markets/top100CardDisplay";
import { TOP_MOVERS_FETCH_COUNT } from "@/lib/markets/top100Copy";

export type TopMoverItem = TopMoverCard & {
  rank: number;
  headlineGrade: string | null;
  headlinePrice: number | null;
};

function pickHeadlinePrice(
  prices: TopMoverCard["prices"],
): { grade: string | null; price: number | null } {
  if (!prices?.length) return { grade: null, price: null };
  const psa10 = prices.find((p) => p.grade.trim().toLowerCase() === "psa 10");
  const row = psa10 ?? prices[0];
  return {
    grade: row.grade,
    price: parseTop100Price(row.price),
  };
}

function toItems(cards: TopMoverCard[]): TopMoverItem[] {
  return cards.map((c, idx) => {
    const headline = pickHeadlinePrice(c.prices);
    return {
      ...c,
      rank: idx + 1,
      headlineGrade: headline.grade,
      headlinePrice: headline.price,
    };
  });
}

export function useTopMovers(category: string, count = TOP_MOVERS_FETCH_COUNT) {
  return useQuery({
    queryKey: rq.cardhedgerTopMovers(category, count),
    queryFn: () => getTopMovers({ category, count }),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    select: (data) => ({
      items: toItems(data.cards),
      category: data.category,
      count: data.count,
      fetchedAt: data.fetchedAt,
      fromCache: data.fromCache,
      cacheExpiresAt: data.cacheExpiresAt,
      gainThreshold: data.gain_threshold,
    }),
  });
}
