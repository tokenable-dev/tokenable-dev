"use client";

import { useMemo, useState } from "react";
import type { AssetListFilter, AssetRow } from "@/lib/portfolio/portfolioTypes";

export function usePortfolioAssetList(
  assetRows: AssetRow[],
  hiddenSet: Set<number>,
) {
  const [assetFilter, setAssetFilter] = useState<AssetListFilter>("all");

  const holdingsAssetRows = useMemo(
    () => assetRows.filter((r) => !hiddenSet.has(r.tokenId)),
    [assetRows, hiddenSet],
  );
  const hiddenAssetRows = useMemo(
    () => assetRows.filter((r) => hiddenSet.has(r.tokenId)),
    [assetRows, hiddenSet],
  );
  const listedAssetCount = useMemo(
    () => holdingsAssetRows.filter((r) => r.listPriceUsd != null).length,
    [holdingsAssetRows],
  );
  const unlistedAssetCount = holdingsAssetRows.length - listedAssetCount;

  const filteredAssetRows = useMemo(() => {
    if (assetFilter === "hidden") return hiddenAssetRows;
    if (assetFilter === "listed") {
      return holdingsAssetRows.filter((r) => r.listPriceUsd != null);
    }
    if (assetFilter === "unlisted") {
      return holdingsAssetRows.filter((r) => r.listPriceUsd == null);
    }
    return holdingsAssetRows;
  }, [assetFilter, holdingsAssetRows, hiddenAssetRows]);

  return {
    assetFilter,
    setAssetFilter,
    holdingsAssetRows,
    hiddenAssetRows,
    listedAssetCount,
    unlistedAssetCount,
    filteredAssetRows,
  };
}
