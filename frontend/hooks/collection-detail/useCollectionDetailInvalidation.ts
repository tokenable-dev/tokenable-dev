"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateAfterCollectionUpdate } from "@/lib/core/invalidation";

export function useCollectionDetailInvalidation(collectionKey: string) {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void invalidateAfterCollectionUpdate(queryClient, collectionKey);
  }, [queryClient, collectionKey]);
}
