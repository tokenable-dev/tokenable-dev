"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postTokenCollectionKeysByTokenIdsBatched, rq } from "@/lib/core";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";
import type { OrderListItem } from "@/lib/core";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";

export function usePortfolioListingCollectionKeys(
  allOrders: OrderListItem[],
  address: string | undefined,
): Map<number, string> {
  return useMemo(() => {
    const m = new Map<number, string>();
    const viewer = address?.trim().toLowerCase() ?? "";
    for (const o of allOrders) {
      if (o.status !== "active" || o.side !== "ask") continue;
      const offerer = o.offerer?.trim().toLowerCase() ?? "";
      if (!offerer || offerer !== viewer) continue;
      const ck = o.collectionKey?.trim();
      if (ck) m.set(Number(o.tokenId), ck.toLowerCase());
    }
    return m;
  }, [allOrders, address]);
}

function buildPortfolioBucketKeySourceSig(
  assets: OwnedAsset[],
  listingCollectionKeyByToken: Map<number, string>,
): string {
  const parts = assets.map((a) => {
    const lk = listingCollectionKeyByToken.get(a.tokenId);
    if (lk) return `${a.tokenId}:L:${lk.toLowerCase()}`;
    const comp = extractBucketComponentsFromMetadata(
      (a.metadata ?? {}) as Record<string, unknown>,
    );
    if (!comp) return `${a.tokenId}:0`;
    return `${a.tokenId}:C:${comp.gradingCompany}|${comp.cardName}|${comp.cardSet}|${comp.gradeScore}|${comp.variantType ?? ""}`;
  });
  parts.sort();
  return parts.join("\u00a7");
}

export function usePortfolioCollectionKeys(input: {
  address: string | undefined;
  isConnected: boolean;
  assets: OwnedAsset[];
  /**
   * Token IDs from useUserAssets — available right after rwaTokens resolves,
   * before metadata is fetched. Passing them here lets us fire the server
   * collection-key lookup in parallel with the metadata batch rather than
   * sequentially after it.
   */
  tokenIds: number[];
  listingCollectionKeyByToken: Map<number, string>;
}) {
  const { address, isConnected, assets, tokenIds, listingCollectionKeyByToken } = input;

  const fetchedTokenIdsRef = useRef<Set<number>>(new Set());
  const [accumulatedServerKeys, setAccumulatedServerKeys] = useState<
    Record<number, string>
  >({});
  const [fetchGeneration, setFetchGeneration] = useState(0);

  useEffect(() => {
    fetchedTokenIdsRef.current = new Set();
    setAccumulatedServerKeys({});
    setFetchGeneration((g) => g + 1);
  }, [address]);

  const pendingTokenIds = useMemo(() => {
    void fetchGeneration;
    return tokenIds.filter((id) => !fetchedTokenIdsRef.current.has(id));
  }, [tokenIds, fetchGeneration]);

  const {
    data: pendingServerKeys,
    isFetching: serverKeysFetching,
    isFetched: pendingBatchFetched,
  } = useQuery({
    queryKey: rq.tokenCollectionKeyBatch(address ?? "", pendingTokenIds),
    queryFn: () => postTokenCollectionKeysByTokenIdsBatched(pendingTokenIds),
    enabled: Boolean(address && isConnected && pendingTokenIds.length > 0),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!pendingBatchFetched || pendingTokenIds.length === 0) return;
    const ids = [...pendingTokenIds];
    for (const id of ids) {
      fetchedTokenIdsRef.current.add(id);
    }
    if (pendingServerKeys) {
      setAccumulatedServerKeys((prev) => ({ ...prev, ...pendingServerKeys }));
    }
    setFetchGeneration((g) => g + 1);
  }, [pendingBatchFetched, pendingServerKeys, pendingTokenIds]);

  const portfolioBucketKeySourceSig = useMemo(
    () => buildPortfolioBucketKeySourceSig(assets, listingCollectionKeyByToken),
    [assets, listingCollectionKeyByToken],
  );

  const portfolioBucketKeysSig = portfolioBucketKeySourceSig;

  const { data: tokenToCollectionKey = {} } = useQuery({
    queryKey: rq.portfolioBucketKeys(address ?? "", portfolioBucketKeysSig),
    queryFn: async () => {
      const o: Record<number, string> = {};
      const backendResolved: Record<number, string> = accumulatedServerKeys;
      await Promise.all(
        assets.map(async (a) => {
          const listingKey = listingCollectionKeyByToken.get(a.tokenId);
          if (listingKey) {
            o[a.tokenId] = listingKey.trim().toLowerCase();
            return;
          }
          const dbKey = backendResolved[a.tokenId];
          if (typeof dbKey === "string" && dbKey.trim()) {
            o[a.tokenId] = dbKey.trim().toLowerCase();
            return;
          }
          const comp = extractBucketComponentsFromMetadata(
            (a.metadata ?? {}) as Record<string, unknown>,
          );
          if (!comp) return;
          const raw = await computeMarketBucketKey(comp);
          if (typeof raw === "string" && raw.trim().length > 0) {
            o[a.tokenId] = raw.trim().toLowerCase();
          }
        }),
      );
      return o;
    },
    enabled: Boolean(
      address &&
        isConnected &&
        assets.length > 0 &&
        (tokenIds.length === 0 || pendingTokenIds.length === 0),
    ),
    staleTime: 60_000,
  });

  const tokenToServerCollectionKey = useMemo(() => {
    const o: Record<number, string> = {};
    for (const a of assets) {
      const listingKey = listingCollectionKeyByToken.get(a.tokenId)?.trim().toLowerCase();
      if (listingKey) {
        o[a.tokenId] = listingKey;
        continue;
      }
      const dbKey = String(accumulatedServerKeys[a.tokenId] ?? "").trim().toLowerCase();
      if (dbKey) o[a.tokenId] = dbKey;
    }
    return o;
  }, [assets, listingCollectionKeyByToken, accumulatedServerKeys]);

  const uniqueCollectionKeys = useMemo(() => {
    return [...new Set(Object.values(tokenToServerCollectionKey))];
  }, [tokenToServerCollectionKey]);

  const serverKeysReady =
    tokenIds.length === 0 ||
    (pendingTokenIds.length === 0 && !serverKeysFetching);

  return {
    tokenToCollectionKey,
    tokenToServerCollectionKey,
    uniqueCollectionKeys,
    serverKeysReady,
    bucketKeysFetching: serverKeysFetching,
  };
}
