"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveOrderForToken } from "@/lib/core";
import {
  parseRwaDetailListingBuyPriceUsdc,
  pickActiveAskListing,
} from "@/lib/marketplace/rwa-detail";

export function useRwaDetailListing(
  tokenId: number,
  tokenIdOk: boolean,
  viewerAddress: string | undefined,
) {
  const {
    data: listing,
    isError: listingError,
  } = useQuery({
    queryKey: ["orders", "by-token-active", tokenId],
    queryFn: () => getActiveOrderForToken(tokenId),
    retry: 1,
    enabled: tokenIdOk,
  });

  const activeAskListing = useMemo(
    () => pickActiveAskListing(listing),
    [listing],
  );

  const listingBuyPriceUsdc = useMemo(
    () => parseRwaDetailListingBuyPriceUsdc(activeAskListing?.considerationAmount),
    [activeAskListing?.considerationAmount],
  );

  const isListingSeller =
    viewerAddress != null &&
    listing?.offerer != null &&
    viewerAddress.toLowerCase() === listing.offerer.toLowerCase();

  return {
    listing,
    listingError,
    activeAskListing,
    listingBuyPriceUsdc,
    isListingSeller,
  };
}
