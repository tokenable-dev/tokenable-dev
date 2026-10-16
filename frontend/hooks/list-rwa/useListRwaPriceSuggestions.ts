"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
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
  type Order,
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
import { bestAskFromRows } from "@/lib/marketplace/unified-order-book";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { isTokenBidOrder, tokenBidTargetTokenId } from "@/lib/seaport/orders/isTokenBidOrder";

const SUGGESTIONS_TRADE_LIMIT = 8;

/** Top active bid that can fill this token — same match as the set-price modal. */
function highestBidUsdForToken(
  bids: Order[] | undefined,
  tokenId: number,
): number | null {
  if (!bids?.length) return null;
  const tokenIdNorm = normalizeDecimalTokenId(tokenId);
  let best = BigInt(0);
  for (const bid of bids) {
    if (bid.status !== "active") continue;
    if (isTokenBidOrder(bid)) {
      if (tokenBidTargetTokenId(bid) !== tokenIdNorm) continue;
    } else if (!isCriteriaCollectionBid(bid)) {
      continue;
    }
    const amount = bidUsdcAmount(bid);
    if (amount > best) best = amount;
  }
  if (best <= BigInt(0)) return null;
  const usd = Number(formatUnits(best, 6));
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

export function useListRwaPriceSuggestions(input: {
  tokenId: number;
  collectionKey?: string | null;
  enabled: boolean;
}) {
  const { tokenId, collectionKey: collectionKeyProp, enabled } = input;
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;
  const rqChainId = activeRqChainId();

  const metaQuery = useQuery({
    queryKey: rq.rwaAssetDetail(tokenId, rqChainId),
    queryFn: () => getResolvedRwaAsset(tokenId),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.metadataDetailStaleMs,
  });

  const metaBundle = metaQuery.data;
  const metadata = metaBundle?.metadata ?? null;

  const serverKeyQuery = useQuery({
    queryKey: rq.tokenCollectionKey(tokenId, rqChainId),
    queryFn: async () => {
      const map = await postTokenCollectionKeysByTokenIds([tokenId]);
      return map[tokenId]?.trim().toLowerCase() || null;
    },
    enabled: enabled && tokenIdOk && !collectionKeyProp?.trim(),
    staleTime: 60_000,
  });

  const serverCollectionKey = serverKeyQuery.data;

  const derivedKeyQuery = useQuery({
    queryKey: rq.rwaBucketKey(tokenId, metaBundle?.tokenURI, rqChainId),
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

  const metadataDerivedCollectionKey = derivedKeyQuery.data;

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
  const tradesQuery = useQuery({
    queryKey: rq.rwaTokenTrades(tokenId, chainId, gradeLabel),
    queryFn: () => getRwaTokenTrades(tokenId, { grade: gradeLabel }),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const tradesPack = tradesQuery.data;

  const collectionDetailQuery = useQuery({
    queryKey: rq.collectionDetail(candidateCollectionKey ?? "", chainId),
    queryFn: () => getMarketplaceCollectionDetailOrNull(candidateCollectionKey!),
    enabled: enabled && tokenIdOk && Boolean(candidateCollectionKey),
    staleTime: marketplaceRqPolicy.collectionDetailStaleMs,
  });

  const collectionDetail = collectionDetailQuery.data;

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

  const snapshotQuery = useQuery({
    queryKey: rq.collectionSnapshots(
      rqChainId,
      persistedCollectionKey ? [persistedCollectionKey] : [],
      "max",
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched([persistedCollectionKey!], "max"),
    enabled: enabled && tokenIdOk && Boolean(persistedCollectionKey),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const snapshotPack = snapshotQuery.data;

  const collectionSnapshot = useMemo(() => {
    if (!persistedCollectionKey) return undefined;
    return snapshotPack?.items?.find(
      (row) => row.collectionKey.toLowerCase() === persistedCollectionKey,
    );
  }, [snapshotPack?.items, persistedCollectionKey]);

  const mintPreviewQuery = useQuery({
    queryKey: ["list-rwa-mint-preview", rqChainId, tokenId] as const,
    queryFn: () => postBatchMintMarketPreviews([tokenId]),
    enabled: enabled && tokenIdOk,
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const mintPreviewPack = mintPreviewQuery.data;
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

  const lowestAskUsd = useMemo(() => {
    // Live Tokenable asks only — snapshot `marketStats.floor` is a historical
    // listing-pool p10 (includes fulfilled asks) and must not fill this slot.
    return bestAskFromRows(collectionDetail?.listings ?? []);
  }, [collectionDetail?.listings]);

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

  const hasPropKey = Boolean(collectionKeyProp?.trim());
  const derivedKeyNeeded = !hasPropKey && Boolean(metaBundle?.metadata);
  const collectionKeySettled =
    hasPropKey ||
    (serverKeyQuery.isFetched &&
      metaQuery.isFetched &&
      (!derivedKeyNeeded || derivedKeyQuery.isFetched));

  const referencesReady =
    !enabled ||
    !tokenIdOk ||
    (metaQuery.isFetched &&
      tradesQuery.isFetched &&
      mintPreviewQuery.isFetched &&
      collectionKeySettled &&
      (!candidateCollectionKey || collectionDetailQuery.isFetched) &&
      (!persistedCollectionKey || snapshotQuery.isFetched));

  const loading = enabled && tokenIdOk && !referencesReady;

  const hasAnyReference =
    marketPriceUsd != null ||
    lowestAskUsd != null ||
    lastTokenableTradeUsd != null ||
    recentTrades.length > 0;

  return {
    collectionKey: persistedCollectionKey ?? candidateCollectionKey,
    gradeLabel,
    marketPriceUsd,
    lowestAskUsd,
    lastTokenableTradeUsd,
    recentTrades,
    highestBidUsd: highestBidUsdForToken(
      collectionDetail?.collectionBids,
      tokenId,
    ),
    loading,
    /** True once every reference query that will run has settled. */
    ready: referencesReady,
    hasAnyReference,
  };
}
