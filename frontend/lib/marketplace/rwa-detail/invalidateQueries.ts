import type { QueryClient } from "@tanstack/react-query";
import { invalidateAfterRwaDetail } from "@/lib/core/invalidation";

/** @deprecated Import `invalidateAfterRwaDetail` from `@/lib/core/invalidation` directly. */
export async function invalidateRwaDetailQueries(
  queryClient: QueryClient,
  input: { tokenId: number; collectionKeyForMatch: string | null },
): Promise<void> {
  await invalidateAfterRwaDetail(queryClient, input);
}
