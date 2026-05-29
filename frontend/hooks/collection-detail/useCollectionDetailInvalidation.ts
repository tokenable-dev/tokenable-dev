"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { rq } from "@/lib/core";

export function useCollectionDetailInvalidation(collectionKey: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["marketplace-collection", collectionKey],
    });
    void queryClient.invalidateQueries({
      queryKey: ["collection-platform-trades", collectionKey],
    });
    void queryClient.invalidateQueries({
      queryKey: ["collection-market-series", collectionKey],
    });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
    void queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    void queryClient.invalidateQueries({ queryKey: rq.collectionsMarketplace() });
  }, [queryClient, collectionKey]);
}
