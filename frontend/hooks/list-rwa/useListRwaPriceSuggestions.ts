"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionDetailOrNull,
  getResolvedRwaAsset,
  getRwaTokenTrades,
  marketplaceRqPolicy,
  postBatchMintMarketPreviews,
  postMarketplaceCollectionSnapshotsBatched,
  postTokenCollectionKeysByTokenIds,
  rq,
  type CollectionPlatformTapeFill,
} from "@/lib/core";
import {
  extractBucketComponentsFromMetadata,
  computeMarketBucketKey,
} from "@/lib/marketplace/bucketKey";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { activeRqChainId } from "@/lib/chains";
import {
  marketHistoryTierFromRwaMetadata,
  marketTierDisplayLabel,
  parseGradeScoreNumber,
  representativeGradeUsd,
  resolveExternalMarketUsd,
} from "@/lib/market";
import { countableTapeFills } from "@/lib/market/tradesVolume";

const SUGGESTIONS_TRADE_LIMIT = 8;

export function useListRwaPriceSuggestions(input: {
  tokenId: number;
  collectionKey?: string | null;
  enabled: boolean;
}) {
  const { tokenId, collectionKey: collectionKeyProp, enabled } = input;
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;

  const { data: metaBundle } = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId),
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
  });

  const metadata = metaBundle?.metadata ?? null;

  const { data: serverCollectionKey } = useQuery({
    queryKey: rq.tokenCollectionKey(tokenId),
    queryFn: async () => {
      const map = await postTokenCollectionKeysByTokenIds([tokenId]);
      return map[tokenId]?.trim().toLowerCase() || null;
    },
    enabled: enabled && tokenIdOk && !collectionKeyProp?.trim(),
    staleTime: 60_000,
  });

  const { data: metadataDerivedCollectionKey } = useQuery({
    queryKey: rq.rwaBucketKey(tokenId, metaBundle?.tokenURI),
    queryFn: async () => {
      const meta = metaBundle?.metadata;
      if (!meta) return null;
      const components = extractBucketComponentsFromMetadata(
        meta as Record<string, unknown>,
      );
      if (!components) return null;
      return await computeMarketBucketKey(components);
    },
    enabled: enabled && tokenIdOk && !!metaBundle?.metadata && !collectionKeyProp,
    staleTime: 60_000,
  });

  const candidateCollectionKey =
    collectionKeyProp?.trim().toLowerCase() ||
    serverCollectionKey ||
    metadataDerivedCollectionKey ||
    null;

  const gradeLabel = useMemo(() => {
    if (!metadata) return undefined;
    return marketTierDisplayLabel(marketHistoryTierFromRwaMetadata(metadata));
  }, [metadata]);

  const bucketComponents = useMemo(() => {
    if (!metadata) return null;
    return extractBucketComponentsFromMetadata(metadata as Record<string, unknown>);
  }, [metadata]);

  const chainId = activeRqChainId();

  /** Cert-based trades for this token — no collection row or bootstrap required. */
  const { data: tradesPack, isLoading: tradesLoading } = useQuery({
    queryKey: rq.rwaTokenTrades(tokenId, chainId, gradeLabel),
    queryFn: () => getRwaTokenTrades(tokenId, { grade: gradeLabel }),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const { data: collectionDetail, isLoading: collectionDetailLoading } = useQuery({
    queryKey: rq.collectionDetail(candidateCollectionKey ?? "", chainId),
    queryFn: () => getMarketplaceCollectionDetailOrNull(candidateCollectionKey!),
    enabled: enabled && tokenIdOk && Boolean(candidateCollectionKey),
    staleTime: marketplaceRqPolicy.collectionDetailStaleMs,
  });

  const persistedCollectionKey = collectionDetail
    ? candidateCollectionKey?.toLowerCase() ?? null
    : null;

  const pricingComponents = useMemo((): CollectionComponents | null => {
    const server = collectionDetail?.collection?.components;
    if (!server && !bucketComponents) return null;
    return {
      ...(bucketComponents ?? {}),
      ...(server ?? {}),
    };
  }, [bucketComponents, collectionDetail?.collection?.components]);

  const { data: snapshotPack, isLoading: snapshotLoading } = useQuery({
    queryKey: rq.collectionSnapshots(
      persistedCollectionKey ? [persistedCollectionKey] : [],
      "max",
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched([persistedCollectionKey!], "max"),
    enabled: enabled && tokenIdOk && Boolean(persistedCollectionKey),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const collectionSnapshot = useMemo(() => {
    if (!persistedCollectionKey) return undefined;
    return snapshotPack?.items?.find(
      (row) => row.collectionKey.toLowerCase() === persistedCollectionKey,
    );
  }, [snapshotPack?.items, persistedCollectionKey]);

  const { data: mintPreviewPack, isLoading: mintPreviewLoading } = useQuery({
    queryKey: ["list-rwa-mint-preview", tokenId] as const,
    queryFn: () => postBatchMintMarketPreviews([tokenId]),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const mintPreview = mintPreviewPack?.[tokenId] ?? null;

  const marketPriceUsd = useMemo(() => {
    const gradeScore = parseGradeScoreNumber(bucketComponents?.gradeScore);
    const fromSnapshot = representativeGradeUsd(
      collectionSnapshot?.gradePrices ?? null,
      gradeScore,
      bucketComponents?.gradeScore,
    );
    if (fromSnapshot != null && fromSnapshot > 0) return fromSnapshot;

    const fromPreview = resolveExternalMarketUsd({
      marketPreview: mintPreview,
      gradePrices: collectionSnapshot?.gradePrices ?? null,
      gradeScore,
      components: pricingComponents,
      spotPriceBasis: collectionSnapshot?.spotPriceBasis ?? null,
    }).usd;
    if (fromPreview != null && fromPreview > 0) return fromPreview;

    const trades = countableTapeFills(tradesPack?.trades ?? []);
    const newest = trades.length
      ? [...trades].sort((a, b) => b.t - a.t)[0]
      : null;
    if (newest && newest.priceUsdc > 0) return newest.priceUsdc;

    const lastPlatform = collectionSnapshot?.lastTokenableTradeUsdc;
    if (lastPlatform != null && Number.isFinite(lastPlatform) && lastPlatform > 0) {
      return lastPlatform;
    }

    return null;
  }, [
    bucketComponents,
    pricingComponents,
    collectionSnapshot?.gradePrices,
    collectionSnapshot?.lastTokenableTradeUsdc,
    collectionSnapshot?.spotPriceBasis,
    mintPreview,
    tradesPack?.trades,
  ]);

  const lastTokenableTradeUsd = useMemo(() => {
    const v = collectionSnapshot?.lastTokenableTradeUsdc;
    if (v != null && Number.isFinite(v) && v > 0) return v;

    const platformFills = countableTapeFills(tradesPack?.trades ?? [])
      .filter((row) => row.source === "platform")
      .sort((a, b) => b.t - a.t);
    const newest = platformFills[0];
    if (newest && newest.priceUsdc > 0) return newest.priceUsdc;

    return null;
  }, [collectionSnapshot?.lastTokenableTradeUsdc, tradesPack?.trades]);

  const recentTrades = useMemo((): CollectionPlatformTapeFill[] => {
    return [...countableTapeFills(tradesPack?.trades ?? [])]
      .sort((a, b) => b.t - a.t)
      .slice(0, SUGGESTIONS_TRADE_LIMIT);
  }, [tradesPack?.trades]);

  const loading =
    tradesLoading ||
    mintPreviewLoading ||
    (Boolean(candidateCollectionKey) && collectionDetailLoading) ||
    (Boolean(persistedCollectionKey) && snapshotLoading);

  const hasAnyReference =
    marketPriceUsd != null ||
    lastTokenableTradeUsd != null ||
    recentTrades.length > 0;

  return {
    collectionKey: persistedCollectionKey ?? candidateCollectionKey,
    gradeLabel,
    marketPriceUsd,
    lastTokenableTradeUsd,
    recentTrades,
    loading,
    hasAnyReference,
  };
}
