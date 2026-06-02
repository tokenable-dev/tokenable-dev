"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMarketplaceCollectionDetailOrNull,
  postMarketplaceCollectionSnapshotsBatched,
  rq,
  marketplaceRqPolicy,
  type CollectionListMarketSnapshot,
} from "@/lib/core";
import {
  formatReferenceChangeCoverageHint,
  parseGradeScoreNumber,
  representativeGradeUsd,
  formatReferenceChangePeriodLabel,
  formatReferenceChangePeriodShort,
  MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
  referenceChangePeriodFromSnapshotMeta,
} from "@/lib/market";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";
import {
  resolveRwaDetailCollectionKeyForMatch,
  resolveRwaDetailCollectionKeyForRedirect,
  rwaDetailCollectionHref,
} from "@/lib/marketplace/rwa-detail";

export function useRwaDetailMarketContext(input: {
  tokenIdOk: boolean;
  fromCollectionParam: string;
  listingCollectionKey?: string | null;
  metadataDerivedCollectionKey: string | null;
}) {
  const {
    tokenIdOk,
    fromCollectionParam,
    listingCollectionKey,
    metadataDerivedCollectionKey,
  } = input;

  const collectionKeyForMatch = useMemo(
    () =>
      resolveRwaDetailCollectionKeyForMatch({
        listingCollectionKey,
        fromCollectionParam,
        metadataDerivedCollectionKey,
      }),
    [listingCollectionKey, fromCollectionParam, metadataDerivedCollectionKey],
  );

  const collectionKeyForRedirect = useMemo(
    () =>
      resolveRwaDetailCollectionKeyForRedirect({
        fromCollectionParam,
        listingCollectionKey,
        metadataDerivedCollectionKey,
      }),
    [fromCollectionParam, listingCollectionKey, metadataDerivedCollectionKey],
  );

  const { data: collectionDetail } = useQuery({
    queryKey: ["marketplace-collection", collectionKeyForMatch],
    queryFn: () => getMarketplaceCollectionDetailOrNull(collectionKeyForMatch!),
    enabled: Boolean(collectionKeyForMatch && tokenIdOk),
    staleTime: 15_000,
  });

  const collectionSnapshotKey = collectionKeyForMatch?.toLowerCase() ?? null;

  const { data: detailSnapshotPack } = useQuery({
    queryKey: rq.collectionSnapshots(
      collectionSnapshotKey ? [collectionSnapshotKey] : [],
      MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
    ),
    queryFn: () =>
      postMarketplaceCollectionSnapshotsBatched(
        [collectionSnapshotKey!],
        MARKET_PRICE_CHANGE_SNAPSHOT_DURATION,
      ),
    enabled: Boolean(collectionSnapshotKey && tokenIdOk),
    staleTime: marketplaceRqPolicy.snapshotsStaleMs,
  });

  const collectionSnapshot: CollectionListMarketSnapshot | undefined = useMemo(() => {
    if (!collectionSnapshotKey) return undefined;
    return detailSnapshotPack?.items?.find(
      (it) => it.collectionKey.toLowerCase() === collectionSnapshotKey,
    );
  }, [detailSnapshotPack?.items, collectionSnapshotKey]);

  const externalRefUsd = useMemo(() => {
    const comp = collectionDetail?.collection?.components as
      | { gradeScore?: string }
      | undefined;
    const usd = representativeGradeUsd(
      collectionSnapshot?.gradePrices ?? null,
      parseGradeScoreNumber(comp?.gradeScore),
      comp?.gradeScore,
    );
    return usd != null && Number.isFinite(usd) && usd > 0 ? usd : null;
  }, [collectionDetail?.collection?.components, collectionSnapshot?.gradePrices]);

  const marketChangePct = useMemo(() => {
    const pct = collectionSnapshot?.marketChangePct;
    return pct != null && Number.isFinite(pct) ? pct : null;
  }, [collectionSnapshot?.marketChangePct]);

  const marketChangePeriodMeta = useMemo(() => {
    const s = collectionSnapshot;
    if (s?.marketChangeSpanSec != null && s.marketChangeSpanSec > 0) {
      return {
        isFullYear: Boolean(s.marketChangeIsFullYear),
        windowSec: s.marketChangeSpanSec,
        refUsd: s.marketChangeRefUsd ?? null,
        refAtSec: s.marketChangeRefAtSec ?? null,
      };
    }
    return referenceChangePeriodFromSnapshotMeta(s);
  }, [collectionSnapshot]);

  const marketChangePeriodLabel = useMemo(
    () => formatReferenceChangePeriodLabel(marketChangePeriodMeta),
    [marketChangePeriodMeta],
  );

  const marketChangeCoverageHint = useMemo(
    () => formatReferenceChangeCoverageHint(marketChangePeriodMeta),
    [marketChangePeriodMeta],
  );

  const marketChangePeriodShort = useMemo(
    () => formatReferenceChangePeriodShort(marketChangePeriodMeta),
    [marketChangePeriodMeta],
  );

  const collectionHref = rwaDetailCollectionHref(collectionKeyForRedirect);

  const collectionDisplayName =
    collectionDetail?.collection?.displayLabel?.trim() || TOKENABLE_RWA_DISPLAY_NAME;

  const collectionBids = collectionDetail?.collectionBids ?? [];

  return {
    collectionKeyForMatch,
    collectionKeyForRedirect,
    collectionDetail,
    collectionHref,
    collectionDisplayName,
    collectionBids,
    externalRefUsd,
    marketChangePct,
    marketChangePeriodLabel,
    marketChangeCoverageHint,
    marketChangePeriodShort,
  };
}
