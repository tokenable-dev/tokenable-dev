import type { QueryClient } from "@tanstack/react-query";

export async function invalidateRwaDetailQueries(
  queryClient: QueryClient,
  input: { tokenId: number; collectionKeyForMatch: string | null },
): Promise<void> {
  const { tokenId, collectionKeyForMatch } = input;
  await queryClient.invalidateQueries({ queryKey: ["orders"] });
  await queryClient.invalidateQueries({ queryKey: ["orders", "by-token-active", tokenId] });
  await queryClient.invalidateQueries({
    queryKey: ["marketplace-detail-metadata", tokenId],
  });
  await queryClient.invalidateQueries({ queryKey: ["rwa-activity", tokenId] });
  await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
  await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
  await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
  if (collectionKeyForMatch) {
    await queryClient.invalidateQueries({
      queryKey: ["marketplace-collection", collectionKeyForMatch],
    });
    await queryClient.invalidateQueries({
      queryKey: ["collection-market-series", collectionKeyForMatch],
    });
    await queryClient.invalidateQueries({
      queryKey: ["collection-snapshots"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["portfolio-market-batch"],
    });
  }
}
