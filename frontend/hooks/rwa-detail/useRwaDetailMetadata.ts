"use client";

import { useQuery } from "@tanstack/react-query";
import { getResolvedRwaAsset, rq, marketplaceRqPolicy } from "@/lib/core";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";

export function useRwaDetailMetadata(tokenId: number, tokenIdOk: boolean) {
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId),
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: tokenIdOk,
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
  });

  const metadata = metaBundle?.metadata ?? null;
  const imageUrl = metaBundle?.imageUrl ?? null;

  const { data: metadataDerivedCollectionKey } = useQuery({
    queryKey: rq.rwaBucketKey(tokenId, metaBundle?.tokenURI),
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
