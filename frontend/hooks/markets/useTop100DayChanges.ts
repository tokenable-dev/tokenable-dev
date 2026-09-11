"use client";

import { useQuery } from "@tanstack/react-query";
import { getTop100History } from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import {
  buildTop100DayChangeMap,
  type Top100DayChangeResult,
} from "@/lib/markets/top100DayChanges";
import type { Top100Item } from "./usePokemonTop100";

export function useTop100DayChanges(category: string, todayItems: Top100Item[]) {
  return useQuery({
    queryKey: rq.cardhedgerTop100History(category, 2),
    queryFn: () => getTop100History(category, 2),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    enabled: todayItems.length > 0,
    select: (snapshots): Top100DayChangeResult =>
      buildTop100DayChangeMap(todayItems, snapshots),
  });
}
