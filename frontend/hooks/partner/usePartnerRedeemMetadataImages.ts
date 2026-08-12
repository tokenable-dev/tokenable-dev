"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { postRwaMetadataBatchBatched } from "@/lib/core";
import type { PartnerRedeemRow } from "@/lib/core";
import { primeRwaMetadataCache } from "@/lib/marketplace";

/** Resolve card images for partner redeems missing `imageUrl` from the API. */
export function usePartnerRedeemMetadataImages(items: PartnerRedeemRow[]) {
  const tokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of items) {
      if (row.imageUrl?.trim()) continue;
      const n = Number(row.tokenId);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
    return [...ids].sort((a, b) => a - b);
  }, [items]);

  const query = useQuery({
    queryKey: ["partner-redeem-metadata-images", tokenIds],
    queryFn: async () => {
      const pack = await postRwaMetadataBatchBatched(tokenIds);
      primeRwaMetadataCache(
        pack.items.map((it) => ({
          tokenId: it.tokenId,
          metadata: it.metadata,
          imageUrl: it.imageUrl,
        })),
      );
      const map = new Map<string, string>();
      for (const it of pack.items) {
        const url = it.imageUrl?.trim();
        if (url) map.set(String(it.tokenId), url);
      }
      return map;
    },
    enabled: tokenIds.length > 0,
    staleTime: 60_000,
  });

  return query.data ?? new Map<string, string>();
}
