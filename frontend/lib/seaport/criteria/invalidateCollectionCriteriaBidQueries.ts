import type { QueryClient } from "@tanstack/react-query";
import { invalidateAfterCriteriaBid } from "@/lib/core/invalidation";

/** @deprecated Import `invalidateAfterCriteriaBid` from `@/lib/core/invalidation` directly. */
export async function invalidateCollectionCriteriaBidQueries(
  queryClient: QueryClient,
  collectionKey: string,
): Promise<void> {
  await invalidateAfterCriteriaBid(queryClient, collectionKey);
}
