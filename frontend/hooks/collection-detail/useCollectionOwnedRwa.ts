"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  postPortfolioAssetsPage,
  postRwaMetadataBatch,
  postTokenCollectionKeysByTokenIdsBatched,
  rq,
  type RwaMetadata,
} from "@/lib/core";
import { listingVerificationTiles } from "@/lib/marketplace/collectionListingModalHelpers";
import { TOKENABLE_VAULT_LABEL } from "@/lib/marketplace/vaultCustodyLabel";

export type CollectionOwnedRwaRow = {
  tokenId: number;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
  certLabel: string;
  vaultLabel: string;
};

/**
 * Wallet-owned tokens in a marketplace collection — for List for sale.
 */
export function useCollectionOwnedRwa(collectionKey: string) {
  const { address } = useAccount();
  const key = collectionKey.trim();
  const addr = address?.trim().toLowerCase() ?? "";

  const query = useQuery({
    queryKey: rq.collectionOwnedRwa(addr, key),
    queryFn: async (): Promise<CollectionOwnedRwaRow[]> => {
      if (!addr || !key) return [];
      const page = await postPortfolioAssetsPage({
        walletAddress: addr,
        ownedIdsOnly: true,
      });
      const owned = (page.ownedTokenIds ?? []).filter(
        (n) => Number.isFinite(n) && n >= 0,
      );
      if (owned.length === 0) return [];

      const keys = await postTokenCollectionKeysByTokenIdsBatched(owned);
      const matched = owned.filter(
        (id) => (keys[id] ?? "").trim().toLowerCase() === key.toLowerCase(),
      );
      if (matched.length === 0) return [];

      const { items } = await postRwaMetadataBatch({ tokenIds: matched });
      const byId = new Map(items.map((row) => [row.tokenId, row]));

      return matched
        .map((tokenId) => {
          const row = byId.get(tokenId);
          const meta = row?.metadata ?? null;
          const tiles = listingVerificationTiles(meta);
          return {
            tokenId,
            metadata: meta,
            imageUrl: row?.imageUrl ?? null,
            certLabel:
              tiles.certNumber !== "—"
                ? `Cert. ${tiles.certNumber}`
                : `Token #${tokenId}`,
            vaultLabel: TOKENABLE_VAULT_LABEL,
          };
        })
        .sort((a, b) => b.tokenId - a.tokenId);
    },
    enabled: Boolean(addr && key),
    staleTime: 30_000,
  });

  const primary = query.data?.[0] ?? null;
  const ownedCardLabel = useMemo(() => {
    if (!primary) return null;
    return `${primary.certLabel} · ${primary.vaultLabel}`;
  }, [primary]);

  return {
    address: addr || undefined,
    rows: query.data ?? [],
    primary,
    ownedCardLabel,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
