"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { postRwaMetadataBatch, rq, type Order, type RwaMetadata } from "@/lib/core";
import { primeRwaMetadataCache } from "@/lib/marketplace";
import {
  bestAskByToken,
  sortedTokenIdsByOldestListing,
} from "@/lib/marketplace/collectionListingUtils";

export function useCollectionDetailListings(params: {
  collectionKey: string;
  asks: Order[];
  enabled: boolean;
}) {
  const { collectionKey, asks, enabled } = params;

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(
    () => (enabled ? sortedTokenIdsByOldestListing(asks) : []),
    [enabled, asks],
  );

  const { data: batchMetadata } = useQuery({
    queryKey: rq.collectionListingsMetadata(collectionKey, tokenIds),
    queryFn: async () => {
      const ids = tokenIds;
      const BATCH_MAX = 80;
      const chunks: number[][] = [];
      for (let i = 0; i < ids.length; i += BATCH_MAX) {
        chunks.push(ids.slice(i, i + BATCH_MAX));
      }
      const packs = await Promise.all(
        chunks.map((chunk) => postRwaMetadataBatch({ tokenIds: chunk })),
      );
      const flat = packs.flatMap((p) => p.items);
      primeRwaMetadataCache(
        flat.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      return new Map(
        flat.map((it) => [
          it.tokenId,
          { metadata: it.metadata as RwaMetadata | null, imageUrl: it.imageUrl },
        ]),
      );
    },
    enabled: enabled && tokenIds.length > 0,
    staleTime: 60_000,
  });

  return {
    askMap,
    tokenIds,
    batchMetadata,
  };
}
