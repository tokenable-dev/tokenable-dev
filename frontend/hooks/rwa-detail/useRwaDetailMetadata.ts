"use client";

import { useQuery } from "@tanstack/react-query";
import { getResolvedRwaAsset, rq, marketplaceRqPolicy, type RwaMetadata } from "@/lib/core";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";
import { getCachedRwaImageUrl, getCachedRwaMetadata } from "@/lib/marketplace";

function cachedAssetInitialData(tokenId: number) {
  const cachedMeta = getCachedRwaMetadata(tokenId) as RwaMetadata | null;
  const cachedImg = getCachedRwaImageUrl(tokenId);
  if (!cachedMeta && !cachedImg) return undefined;
  return {
    tokenId,
    tokenURI: "",
    metadata: cachedMeta,
    imageUrl: cachedImg,
    imageBackUrl: null as string | null,
  };
}

export function useRwaDetailMetadata(tokenId: number, tokenIdOk: boolean) {
  const { data: metaBundle, isLoading: metaLoading } = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId),
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: tokenIdOk,
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
    initialData: () => cachedAssetInitialData(tokenId),
  });

  const metadata = metaBundle?.metadata ?? null;
  const imageUrl = metaBundle?.imageUrl ?? null;
  const imageBackUrl = metaBundle?.imageBackUrl ?? null;

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
    imageBackUrl,
    metaLoading,
    metadataDerivedCollectionKey: metadataDerivedCollectionKey ?? null,
  };
}
