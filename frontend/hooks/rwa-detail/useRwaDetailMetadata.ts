"use client";

import { useQuery } from "@tanstack/react-query";
import { getResolvedRwaAsset } from "@/lib/core";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";

export function useRwaDetailMetadata(tokenId: number, tokenIdOk: boolean) {
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: ["marketplace-detail-metadata", tokenId],
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: tokenIdOk,
    staleTime: 60_000,
  });

  const metadata = metaBundle?.metadata ?? null;
  const imageUrl = metaBundle?.imageUrl ?? null;

  const { data: metadataDerivedCollectionKey } = useQuery({
    queryKey: ["metadata-bucket-key", tokenId, metaBundle?.tokenURI],
    queryFn: async () => {
      const meta = metaBundle?.metadata;
      if (!meta) return null;
      const c = extractBucketComponentsFromMetadata(meta as Record<string, unknown>);
      if (!c) return null;
      return await computeMarketBucketKey(c);
    },
    enabled: tokenIdOk && !!metaBundle?.metadata,
    staleTime: 60_000,
  });

  return {
    metaBundle,
    metadata,
    imageUrl,
    metaLoading,
    metadataDerivedCollectionKey: metadataDerivedCollectionKey ?? null,
  };
}
