"use client";

import { useQuery } from "@tanstack/react-query";
import { getMerkleEligibleTokenIds } from "@/lib/core";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";

/**
 * Canonical Seaport Merkle root for the collection’s current minted-in-bucket token set.
 * Invalidates with the same prefix as `["merkle-set", collectionKey]` so bid/list flows refresh it.
 */
export function useCollectionMerkleRootHex(collectionKey: string | undefined) {
  const k = collectionKey?.trim() ?? "";
  return useQuery({
    queryKey: ["merkle-set", k, "root"],
    queryFn: async (): Promise<string | null> => {
      if (!k) return null;
      const { tokenIds } = await getMerkleEligibleTokenIds(k, { bypassCache: false });
      if (!tokenIds.length) return null;
      const ids = tokenIds.map((t) => BigInt(normalizeDecimalTokenId(t)));
      return new SeaportMerkleTree(ids).getHexRoot();
    },
    enabled: k.length > 0,
    staleTime: 20_000,
  });
}
