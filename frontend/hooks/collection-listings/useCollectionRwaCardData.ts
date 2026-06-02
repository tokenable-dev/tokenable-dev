"use client";

import { useQuery } from "@tanstack/react-query";
import { getResolvedRwaAsset, marketplaceRqPolicy, rq, type RwaMetadata } from "@/lib/core";
import { getCachedRwaImageUrl, getCachedRwaMetadata } from "@/lib/marketplace";

/**
 * Fetches resolved RWA asset data (tokenURI + metadata + imageUrl) for a single
 * token within a collection listing card.
 *
 * When prefetched data is supplied by the parent (cover image or metadata),
 * the network fetch is skipped and the prefetched values are returned instead.
 * Falls back to the in-memory metadata cache before issuing a network request.
 */
export function useCollectionRwaCardData(input: {
  tokenId: number;
  prefetchedImageUrl?: string | null;
  prefetchedMetadata?: RwaMetadata | null;
}) {
  const { tokenId, prefetchedImageUrl, prefetchedMetadata } = input;

  const hasPrefetch =
    prefetchedImageUrl !== undefined || prefetchedMetadata !== undefined;

  const { data: metaBundle } = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId),
    queryFn: () => getResolvedRwaAsset(tokenId),
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
    enabled: !hasPrefetch,
    initialData: hasPrefetch
      ? undefined
      : (() => {
          const cachedMeta = getCachedRwaMetadata(tokenId) as RwaMetadata | null;
          const cachedImg = getCachedRwaImageUrl(tokenId);
          if (cachedMeta || cachedImg) {
            return {
              tokenId,
              tokenURI: "",
              metadata: cachedMeta,
              imageUrl: cachedImg,
            };
          }
          return undefined;
        })(),
  });

  const metadata: RwaMetadata | null = hasPrefetch
    ? (prefetchedMetadata ?? null)
    : (metaBundle?.metadata ?? null);

  const imageUrl: string | null = hasPrefetch
    ? (prefetchedImageUrl ?? null)
    : (metaBundle?.imageUrl ?? null);

  return { metaBundle, metadata, imageUrl };
}
