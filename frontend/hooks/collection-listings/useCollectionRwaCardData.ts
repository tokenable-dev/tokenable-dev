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

  const prefetchedImageReady =
    typeof prefetchedImageUrl === "string" && prefetchedImageUrl.trim().length > 0;
  const prefetchedMetadataReady = prefetchedMetadata != null;
  /** Skip network only when both image and metadata are already available. */
  const prefetchComplete = prefetchedImageReady && prefetchedMetadataReady;

  const { data: metaBundle } = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId),
    queryFn: async () => {
      const resolved = await getResolvedRwaAsset(tokenId);
      const cachedImg = getCachedRwaImageUrl(tokenId);
      if (!resolved.imageUrl?.trim() && cachedImg) {
        return { ...resolved, imageUrl: cachedImg };
      }
      return resolved;
    },
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
    enabled: !prefetchComplete,
    initialData: prefetchComplete
      ? undefined
      : (() => {
          const cachedMeta =
            prefetchedMetadata ??
            (getCachedRwaMetadata(tokenId) as RwaMetadata | null);
          const cachedImg =
            (prefetchedImageReady ? prefetchedImageUrl!.trim() : null) ??
            getCachedRwaImageUrl(tokenId);
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

  const metadata: RwaMetadata | null =
    prefetchedMetadata ?? metaBundle?.metadata ?? null;

  const imageUrl: string | null = prefetchedImageReady
    ? prefetchedImageUrl!.trim()
    : (metaBundle?.imageUrl ?? null);

  return { metaBundle, metadata, imageUrl };
}
