"use client";

import { useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  hydratePortfolioQueries,
  subscribePortfolioPersistence,
} from "@/lib/portfolio/portfolioQueryPersistence";

/**
 * Hydrates portfolio React Query from localStorage after mount (instant paint on refresh),
 * then keeps storage in sync after successful fetches.
 */
export function PortfolioQueryPersistence() {
  const queryClient = useQueryClient();
  const hydrated = useRef(false);

  useLayoutEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      hydratePortfolioQueries(queryClient);
    }
    return subscribePortfolioPersistence(queryClient);
  }, [queryClient]);

  return null;
}
