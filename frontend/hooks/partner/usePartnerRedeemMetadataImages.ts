"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  postRwaMetadataBatchBatched,
  type RwaMetadata,
} from "@/lib/core";
import type { PartnerRedeemRow } from "@/lib/core";
import { primeRwaMetadataCache } from "@/lib/marketplace";

export type PartnerRedeemCardMeta = {
  images: ReadonlyMap<string, string>;
  metadataByTokenId: ReadonlyMap<string, RwaMetadata>;
};

const EMPTY: PartnerRedeemCardMeta = {
  images: new Map(),
  metadataByTokenId: new Map(),
};

/**
 * Batch-load RWA metadata for partner redeem rows.
 * Powers card images (legacy rows without `imageUrl`) and Line 1 titles
 * (`{Name} · {Number} · {Grade}`).
 */
export function usePartnerRedeemMetadata(
  items: PartnerRedeemRow[],
): PartnerRedeemCardMeta {
  const tokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of items) {
      const n = Number(row.tokenId);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
    return [...ids].sort((a, b) => a - b);
  }, [items]);

  const query = useQuery({
    queryKey: ["partner-redeem-card-meta", tokenIds],
    queryFn: async (): Promise<PartnerRedeemCardMeta> => {
      const pack = await postRwaMetadataBatchBatched(tokenIds);
      primeRwaMetadataCache(
        pack.items.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      const images = new Map<string, string>();
      const metadataByTokenId = new Map<string, RwaMetadata>();
      for (const it of pack.items) {
        const key = String(it.tokenId);
        const url = it.imageUrl?.trim();
        if (url) images.set(key, url);
        if (it.metadata) metadataByTokenId.set(key, it.metadata);
      }
      return { images, metadataByTokenId };
    },
    enabled: tokenIds.length > 0,
    staleTime: 60_000,
  });

  return query.data ?? EMPTY;
}

/** @deprecated Prefer {@link usePartnerRedeemMetadata}. */
export function usePartnerRedeemMetadataImages(items: PartnerRedeemRow[]) {
  return usePartnerRedeemMetadata(items).images;
}
