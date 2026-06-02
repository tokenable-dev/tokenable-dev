"use client";

import { useMemo } from "react";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";
import {
  buildRwaDetailStatRows,
  getRwaDetailHeaderBadgeLabels,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail";
import { filterRedundantRwaDetailStatRows } from "@/lib/marketplace/rwa-detail/rwaDetailStatRowsFilter";
import {
  assetDetailHeadlineHasContent,
  buildRwaAssetDetailHeadlineParts,
  formatAssetDetailHeadlineText,
} from "@/lib/marketplace/assetDetailHeadline";

export function useRwaDetailHeadline(
  tokenId: number,
  metadata: RwaDetailMetadata | null,
  metaLoading: boolean,
) {
  const detailHeadlineFallback = `${TOKENABLE_RWA_DISPLAY_NAME} #${tokenId}`;

  const detailHeadlineParts = useMemo(
    () => buildRwaAssetDetailHeadlineParts(metadata, detailHeadlineFallback),
    [metadata, detailHeadlineFallback],
  );

  const detailTitle = useMemo(
    () => formatAssetDetailHeadlineText(detailHeadlineParts),
    [detailHeadlineParts],
  );

  const detailTitlePulse =
    Boolean(metaLoading) &&
    !metadata?.name?.trim() &&
    !assetDetailHeadlineHasContent(detailHeadlineParts);

  const rwaDetailStatRows = useMemo(() => {
    const raw = buildRwaDetailStatRows(metadata);
    const badges = getRwaDetailHeaderBadgeLabels(metadata);
    return filterRedundantRwaDetailStatRows(raw, detailHeadlineParts, badges);
  }, [metadata, detailHeadlineParts]);

  return {
    detailHeadlineParts,
    detailTitle,
    detailTitlePulse,
    rwaDetailStatRows,
  };
}
