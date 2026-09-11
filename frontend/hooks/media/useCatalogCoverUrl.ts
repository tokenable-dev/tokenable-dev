"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchCardhedgerCards } from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import { pickCardhedgerCatalogCoverUrl } from "@/lib/marketplace/cardhedgerBubbleCoverImage";
import { resolveTop100ImageUrl } from "@/lib/markets/top100CardDisplay";

/**
 * Prefer an existing cover URL; when missing, resolve via Cardhedger card-search
 * (Bubble `/crop_image`).
 */
export function useCatalogCoverUrl(opts: {
  existingUrl?: string | null;
  search?: string | null;
  enabled?: boolean;
}) {
  const existing = resolveTop100ImageUrl(opts.existingUrl ?? null);
  const search = opts.search?.trim() ?? "";
  const enabled = (opts.enabled ?? true) && !existing && search.length > 0;

  const query = useQuery({
    queryKey: rq.cardhedgerCatalogCover(search),
    queryFn: async () => {
      const { cards } = await searchCardhedgerCards({
        search,
        page: 1,
        page_size: 10,
      });
      return pickCardhedgerCatalogCoverUrl(cards);
    },
    enabled,
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
  });

  return useMemo(
    () => ({
      url: existing ?? query.data ?? null,
      isPending: enabled && query.isPending,
    }),
    [existing, query.data, query.isPending, enabled],
  );
}
