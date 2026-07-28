"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllMarketplaceCollections,
  marketplaceRqPolicy,
  rq,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { pickHeroCarouselCoverUrls } from "@/lib/home/heroCarouselAssets";

/**
 * Unique marketplace collection covers (S3) for the home hero ring.
 * Shares `rq.homeAllCollections()` with the home grids.
 */
export function useHeroCarouselImageSources() {
  const chainId = activeRqChainId();
  const { data: collections, isPending } = useQuery({
    queryKey: rq.homeAllCollections(chainId),
    queryFn: getAllMarketplaceCollections,
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const data = useMemo(
    () => pickHeroCarouselCoverUrls(collections ?? []),
    [collections],
  );

  return { data, isPending };
}
