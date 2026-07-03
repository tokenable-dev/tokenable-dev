"use client";

import { useEffect, useMemo } from "react";
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

  // Fire the server collection-key batch as soon as tokenIds are available —
  // in parallel with postRwaMetadataBatch. Both requests only need tokenIds.
  const { data: prefetchedServerKeys } = useQuery({
    queryKey: rq.tokenCollectionKeyBatch(address ?? "", tokenIds),
    queryFn: () => postTokenCollectionKeysByTokenIdsBatched(tokenIds),
    enabled: Boolean(address && isConnected && tokenIds.length > 0),
    staleTime: 60_000,
  });

  const portfolioBucketKeySourceSig = useMemo(
    () => buildPortfolioBucketKeySourceSig(assets, listingCollectionKeyByToken),
    [assets, listingCollectionKeyByToken],
  );

  const portfolioBucketKeysSig = portfolioBucketKeySourceSig;

  const { data: tokenToCollectionKey = {}, isFetching: bucketKeysFetching } = useQuery({
    queryKey: rq.portfolioBucketKeys(address ?? "", portfolioBucketKeysSig),
    queryFn: async () => {
      const o: Record<number, string> = {};
      // prefetchedServerKeys is guaranteed to be defined when this queryFn runs
      // because `enabled` below requires it. No extra network call needed here.
      const backendResolved: Record<number, string> = prefetchedServerKeys ?? {};
      for (const a of assets) {
        const listingKey = listingCollectionKeyByToken.get(a.tokenId);
        if (listingKey) {
          o[a.tokenId] = listingKey.trim().toLowerCase();
          continue;
        }
        const dbKey = backendResolved[a.tokenId];
        if (typeof dbKey === "string" && dbKey.trim()) {
          o[a.tokenId] = dbKey.trim().toLowerCase();
          continue;
        }
        const comp = extractBucketComponentsFromMetadata(
          (a.metadata ?? {}) as Record<string, unknown>,
        );
        if (!comp) continue;
        const raw = await computeMarketBucketKey(comp);
        if (typeof raw === "string" && raw.trim().length > 0) {
          o[a.tokenId] = raw.trim().toLowerCase();
        }
      }
      return o;
    },
    // Wait until BOTH metadata (assets) and server keys are ready.
    // Since both fire in parallel, the total wait is max(metadata, serverKeys)
    // instead of metadata + serverKeys (sequential).
    enabled: Boolean(
      address &&
        isConnected &&
        assets.length > 0 &&
        (tokenIds.length === 0 || prefetchedServerKeys !== undefined),
    ),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MARKETPLACE_PIPELINE_DIAG !== "1") return;
    assets.forEach((a) => {
      const fromOrder = listingCollectionKeyByToken.get(a.tokenId);
      const fromMeta =
        typeof tokenToCollectionKey[a.tokenId] === "string" &&
        tokenToCollectionKey[a.tokenId]!.trim()
          ? tokenToCollectionKey[a.tokenId]!.trim().toLowerCase()
          : undefined;
      if (fromOrder && fromMeta && fromOrder !== fromMeta) {
        console.warn("[collection_key_pipeline] listing vs meta hash mismatch", {
          tokenId: a.tokenId,
          fromActiveListingOrder: fromOrder,
          fromClientMetadata: fromMeta,
          note: "Order row collection_key differs from computeMarketBucketKey(metadata).",
        });
      }
      if (fromOrder && fromMeta && fromOrder === fromMeta) {
        console.info("[collection_key_pipeline] listing and meta keys match", {
          tokenId: a.tokenId,
          collectionKey: fromOrder,
        });
      }
    });
  }, [assets, listingCollectionKeyByToken, tokenToCollectionKey]);

  const uniqueCollectionKeys = useMemo(() => {
    const s = new Set<string>();
    for (const a of assets) {
      const k = tokenToCollectionKey[a.tokenId];
      if (k) s.add(k);
    }
    return [...s];
  }, [assets, tokenToCollectionKey]);

  return {
    tokenToCollectionKey,
    uniqueCollectionKeys,
    bucketKeysFetching,
  };
}
