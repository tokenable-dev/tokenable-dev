"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminRwaCards,
  patchAdminRwaToken,
  postAdminPreviewRwaMetadataImage,
  rq,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

export function useMarketplaceAdminCards() {
  const qc = useQueryClient();
  const { chainId } = useAppChain();

  const query = useQuery({
    queryKey: rq.adminRwaCards(chainId),
    queryFn: () => getAdminRwaCards(),
    staleTime: 30_000,
  });

  const invalidateCard = async (tokenId: number) => {
    await qc.invalidateQueries({ queryKey: rq.adminRwaCards(chainId) });
    await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(tokenId) });
  };

  const updateMutation = useMutation({
    mutationFn: (input: {
      tokenId: number;
      displayImageUrl?: string | null;
      displayName?: string | null;
      collectionKey?: string | null;
    }) => {
      const { tokenId, ...patch } = input;
      return patchAdminRwaToken(tokenId, patch);
    },
    onSuccess: async (_data, vars) => {
      await invalidateCard(vars.tokenId);
    },
  });

  const previewMetadataImage = async (tokenId: number) => {
    return postAdminPreviewRwaMetadataImage(tokenId);
  };

  return {
    query,
    updateMutation,
    previewMetadataImage,
    invalidateCard,
  };
}
