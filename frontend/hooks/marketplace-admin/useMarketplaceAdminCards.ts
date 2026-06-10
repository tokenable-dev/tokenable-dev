"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  getAdminListedRwaCards,
  patchAdminRwaToken,
  postAdminPreviewRwaMetadataImage,
  rq,
} from "@/lib/core";

export function useMarketplaceAdminCards(adminWallet: Address | undefined) {
  const qc = useQueryClient();
  const wallet = adminWallet?.toLowerCase();

  const query = useQuery({
    queryKey: rq.adminListedRwaCards(wallet ?? ""),
    queryFn: () => getAdminListedRwaCards(wallet!),
    enabled: Boolean(wallet),
    staleTime: 30_000,
  });

  const invalidateCard = async (tokenId: number) => {
    if (wallet) {
      await qc.invalidateQueries({ queryKey: rq.adminListedRwaCards(wallet) });
    }
    await qc.invalidateQueries({ queryKey: rq.rwaAssetDetail(tokenId) });
  };

  const updateMutation = useMutation({
    mutationFn: (input: {
      tokenId: number;
      displayImageUrl?: string | null;
      displayName?: string | null;
      collectionKey?: string | null;
    }) => {
      if (!wallet) throw new Error("Admin wallet required");
      const { tokenId, ...patch } = input;
      return patchAdminRwaToken(tokenId, {
        adminWallet: wallet,
        ...patch,
      });
    },
    onSuccess: async (_data, vars) => {
      await invalidateCard(vars.tokenId);
    },
  });

  const previewMetadataImage = async (tokenId: number) => {
    if (!wallet) throw new Error("Admin wallet required");
    return postAdminPreviewRwaMetadataImage(tokenId, { adminWallet: wallet });
  };

  return {
    query,
    updateMutation,
    previewMetadataImage,
    invalidateCard,
  };
}
