"use client";

import { useLayoutEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  hydrateMarketplaceQueries,
  subscribeMarketplacePersistence,
} from "@/lib/marketplace";

/**
 * Hydrates React Query from localStorage for marketplace list + price snapshots,
 * and keeps storage in sync (debounced) after successful fetches.
 */
export function MarketplaceQueryPersistence() {
  const queryClient = useQueryClient();
  const hydrated = useRef(false);

  useLayoutEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      hydrateMarketplaceQueries(queryClient);
    }
    return subscribeMarketplacePersistence(queryClient);
  }, [queryClient]);

  return null;
}
