"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { postRwaMetadataBatch, rq, type Order, type RwaMetadata } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { primeRwaMetadataCache } from "@/lib/marketplace";
import {
  bestAskByToken,
  sortedTokenIdsByLowestAsk,
} from "@/lib/marketplace/collectionListingUtils";

export function useCollectionDetailListings(params: {
  collectionKey: string;
  asks: Order[];
  enabled: boolean;
}) {
  const { collectionKey, asks, enabled } = params;
  const { address } = useAccount();
  const viewerWallet = address?.trim() ?? "";
  const chainId = activeRqChainId();

  const askMap = useMemo(() => bestAskByToken(asks), [asks]);
  const tokenIds = useMemo(
    () => (enabled ? sortedTokenIdsByLowestAsk(asks) : []),
    [enabled, asks],
  );

  const { data: batchMetadata } = useQuery({
    queryKey: rq.collectionListingsMetadata(
      collectionKey,
      tokenIds,
      viewerWallet,
    ),
    queryFn: async () => {
      const ids = tokenIds;
      const BATCH_MAX = 80;
      const chunks: number[][] = [];
      for (let i = 0; i < ids.length; i += BATCH_MAX) {
        chunks.push(ids.slice(i, i + BATCH_MAX));
      }
      const packs = await Promise.all(
        chunks.map((chunk) =>
          postRwaMetadataBatch({
            tokenIds: chunk,
            viewerWalletAddress: viewerWallet || undefined,
          }),
        ),
      );
      const flat = packs.flatMap((p) => p.items);
      primeRwaMetadataCache(
        chainId,
        flat.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      return new Map(
        flat.map((it) => [
          it.tokenId,
          { metadata: it.metadata as RwaMetadata | null, imageUrl: it.imageUrl, imageBackUrl: it.imageBackUrl ?? null },
        ]),
      );
    },
    enabled: enabled && tokenIds.length > 0,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    askMap,
    tokenIds,
    batchMetadata,
  };
}
