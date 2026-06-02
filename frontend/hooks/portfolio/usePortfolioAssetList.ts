"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AssetListFilter, AssetRow } from "@/lib/portfolio/portfolioTypes";

const ASSET_PAGE = 10;

export function usePortfolioAssetList(
  assetRows: AssetRow[],
  hiddenSet: Set<number>,
) {
  const [assetFilter, setAssetFilter] = useState<AssetListFilter>("all");
  const [visibleAssetCount, setVisibleAssetCount] = useState(ASSET_PAGE);

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

  useEffect(() => {
    setVisibleAssetCount((n) =>
      filteredAssetRows.length === 0
        ? ASSET_PAGE
        : Math.min(Math.max(n, ASSET_PAGE), filteredAssetRows.length),
    );
  }, [filteredAssetRows.length]);

  const pagedAssetRows = useMemo(
    () => filteredAssetRows.slice(0, visibleAssetCount),
    [filteredAssetRows, visibleAssetCount],
  );

  const assetScrollSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = assetScrollSentinelRef.current;
    if (!el || visibleAssetCount >= filteredAssetRows.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleAssetCount((c) => Math.min(c + ASSET_PAGE, filteredAssetRows.length));
        }
      },
      { root: null, rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleAssetCount, filteredAssetRows.length]);

  return {
    assetFilter,
    setAssetFilter,
    holdingsAssetRows,
    hiddenAssetRows,
    listedAssetCount,
    unlistedAssetCount,
    filteredAssetRows,
    pagedAssetRows,
    visibleAssetCount,
    assetScrollSentinelRef,
  };
}
