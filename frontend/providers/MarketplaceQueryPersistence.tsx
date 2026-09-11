"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  hydrateMarketplaceQueries,
  subscribeMarketplacePersistence,
} from "@/lib/marketplace";

/**
 * Hydrates React Query from localStorage after hydration (useEffect, not useLayoutEffect),
 * then keeps storage in sync (debounced) after successful fetches.
 */
export function MarketplaceQueryPersistence() {
  const queryClient = useQueryClient();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      hydrateMarketplaceQueries(queryClient);
    }
    return subscribeMarketplacePersistence(queryClient);
  }, [queryClient]);

  return null;
}
