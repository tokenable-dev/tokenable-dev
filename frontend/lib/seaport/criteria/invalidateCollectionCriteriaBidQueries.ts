import type { QueryClient } from "@tanstack/react-query";

export async function invalidateCollectionCriteriaBidQueries(
  queryClient: QueryClient,
  collectionKey: string,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
  await queryClient.invalidateQueries({
    queryKey: ["collection-platform-trades", collectionKey],
  });
  await queryClient.invalidateQueries({ queryKey: ["collection-market-series"] });
  await queryClient.invalidateQueries({ queryKey: ["orders"] });
  await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
  await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
  await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
  await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
  await queryClient.invalidateQueries({
    predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
  });
}
