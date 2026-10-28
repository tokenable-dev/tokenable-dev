"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { RwaMetadata } from "@/lib/core";
import type { PortfolioCostBasisSource } from "@/lib/core/api/portfolio";
import { postRwaVaultInfoBatch, rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import { isRedeemInFlight, redeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  holdingsLifecycleSeg,
  matchesAssetsSegment,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";
import {
  compareSortNum,
  formatPortfolioGradeLabel,
  resolvePortfolioHoldingsHeadlines,
} from "@/lib/portfolio/portfolioTableHelpers";
import { portfolioTableVaultChip } from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { TkButton } from "@/components/ds";
import {
  PortfolioAssetsToolbar,
  type AssetsToolbarSort,
  type AssetsViewMode,
} from "./PortfolioAssetsToolbar";
import { useIsMobileViewport } from "@/hooks/ui/useIsMobileViewport";
import { usePathname } from "next/navigation";
import {
  portfolioAssetHref,
  portfolioBasePath,
} from "@/lib/portfolio/portfolioPaths";
import { isKbwMysteryCardTokenId } from "@/lib/portfolio/kbwMysteryCard";
import { PortfolioHoldingsGalleryTile } from "./PortfolioHoldingsGalleryTile";
import { PortfolioHoldingsTableView } from "./PortfolioHoldingsTableView";
export function PortfolioHoldingsSection({
  assetsSectionLoading,
  assetRows,
  metadataByTokenId,
  costBasisByTokenId,
  costBasisSourceByTokenId,
  acquiredAtByTokenId,
  valuesPending,
  onSetPrice,
  onRequestCancelListings,
  onOpenKbwMysteryCard,
  cancellingListingTokenId = null,
  redeemStatusByTokenId,
  redeemTrackingByTokenId,
  redeemCarrierDeliveredByTokenId,
  redeemPaymentBatchByTokenId,
  hasMoreAssets = false,
  isLoadingMoreAssets = false,
  onLoadMoreAssets,
  loadedAssetCount,
  totalAssetCount,
  hiddenTokenIds,
  onBulkHide,
  onBulkUnhide,
  bulkHidePending = false,
}: {
  assetsSectionLoading: boolean;
  assetRows: AssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  costBasisByTokenId: Map<number, number>;
  costBasisSourceByTokenId?: Map<number, PortfolioCostBasisSource | null>;
  acquiredAtByTokenId?: Map<number, string>;
  valuesPending: boolean;
  onSetPrice: (tokenId: number, draftPriceUsdc?: string | null) => void;
  onRequestCancelListings?: (
    items: {
      tokenId: number;
      assetTitle: string;
      gradeLabel: string | null;
      orderHash: string;
      listPriceUsd: number | null;
    }[],
  ) => void;
  onOpenKbwMysteryCard?: () => void;
  cancellingListingTokenId?: number | null;
  redeemStatusByTokenId?: Map<number, string>;
  redeemTrackingByTokenId?: Map<number, string>;
  redeemCarrierDeliveredByTokenId?: Map<number, string>;
  redeemPaymentBatchByTokenId?: Map<number, string>;
  hasMoreAssets?: boolean;
  isLoadingMoreAssets?: boolean;
  onLoadMoreAssets?: () => void;
  loadedAssetCount?: number;
  totalAssetCount?: number;
  hiddenTokenIds?: Set<number>;
  onBulkHide?: (tokenIds: number[]) => void | Promise<void>;
  onBulkUnhide?: (tokenIds: number[]) => void | Promise<void>;
  bulkHidePending?: boolean;
}) {
  const hiddenSet = hiddenTokenIds ?? new Set<number>();
  const [segment, setSegment] = useState<AssetsSegment>("all");
  const [sort, setSort] = useState<AssetsToolbarSort>("newest");
  /** Default: gallery tiles on mobile and desktop (table is opt-in). */
  const [view, setView] = useState<AssetsViewMode>("gallery");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<number>>(() => new Set());
  const isMobile = useIsMobileViewport(768);
  const isPadOrPhone = useIsMobileViewport(1024);
  /** Gallery through pad/phone; table is desktop-only (Portfolio.html). */
  const showGalleryGrid = view === "gallery" || isPadOrPhone;
  const pathname = usePathname();
  const assetsBase = portfolioBasePath(pathname);

  function getBadge(tokenId: number) {
    return redeemSurfaceBadge(
      redeemStatusByTokenId?.get(tokenId),
      redeemTrackingByTokenId?.get(tokenId),
      redeemCarrierDeliveredByTokenId?.get(tokenId),
      redeemPaymentBatchByTokenId?.get(tokenId),
    );
  }

  const headlineByTokenId = useMemo(
    () => resolvePortfolioHoldingsHeadlines(assetRows, metadataByTokenId),
    [assetRows, metadataByTokenId],
  );

  const vaultTokenIds = useMemo(
    () =>
      assetRows
        .map((r) => r.tokenId)
        .filter((id) => !isKbwMysteryCardTokenId(id)),
    [assetRows],
  );
  const chainId = activeRqChainId();
  const vaultInfoQuery = useQuery({
    queryKey: rq.rwaVaultInfoBatch(undefined, vaultTokenIds, chainId),
    queryFn: () => postRwaVaultInfoBatch(vaultTokenIds),
    enabled: vaultTokenIds.length > 0,
    staleTime: 60_000,
  });
  const vaultByTokenId = useMemo(() => {
    const m = new Map<
      number,
      { text: string; tone: "psa" | "partner" }
    >();
    for (const item of vaultInfoQuery.data?.items ?? []) {
      const id = Number(item.tokenId);
      if (!Number.isFinite(id)) continue;
      const chip = portfolioTableVaultChip(item.vaultLabel);
      if (chip) m.set(id, chip);
    }
    return m;
  }, [vaultInfoQuery.data]);

  const filteredSortedRows = useMemo(() => {
    const rows = assetRows.filter((row) => {
      const isListed =
        row.listPriceUsd != null && row.activeListingOrderHash != null;
      const badge = getBadge(row.tokenId);
      const seg = holdingsLifecycleSeg(isListed, badge);
      return matchesAssetsSegment(seg, segment, {
        hidden: hiddenSet.has(row.tokenId),
      });
    });

    rows.sort((a, b) => {
      const aKbw = isKbwMysteryCardTokenId(a.tokenId);
      const bKbw = isKbwMysteryCardTokenId(b.tokenId);
      if (aKbw !== bKbw) return aKbw ? -1 : 1;

      switch (sort) {
        case "newest": {
          const isoA = acquiredAtByTokenId?.get(a.tokenId);
          const isoB = acquiredAtByTokenId?.get(b.tokenId);
          const msA = isoA ? Date.parse(isoA) : NaN;
          const msB = isoB ? Date.parse(isoB) : NaN;
          const cmp = compareSortNum(
            Number.isFinite(msA) ? msA : null,
            Number.isFinite(msB) ? msB : null,
            "desc",
          );
          return cmp !== 0 ? cmp : b.tokenId - a.tokenId;
        }
        case "value":
          return compareSortNum(a.currentPrice, b.currentPrice, "desc");
        case "low":
          return compareSortNum(a.currentPrice, b.currentPrice, "asc");
        default:
          return compareSortNum(a.currentPrice, b.currentPrice, "desc");
      }
    });
    return rows;
    // getBadge reads redeem maps; include those deps explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- badge maps listed below
  }, [
    assetRows,
    segment,
    sort,
    metadataByTokenId,
    acquiredAtByTokenId,
    redeemStatusByTokenId,
    redeemTrackingByTokenId,
    redeemCarrierDeliveredByTokenId,
    redeemPaymentBatchByTokenId,
    headlineByTokenId,
    hiddenSet,
  ]);

  const isSelectionEligible = useCallback(
    (row: AssetRow) => {
      if (isKbwMysteryCardTokenId(row.tokenId)) return false;
      const isHidden = hiddenSet.has(row.tokenId);
      if (segment === "hidden") return isHidden;
      if (isHidden) return false;
      const isListed =
        row.listPriceUsd != null && row.activeListingOrderHash != null;
      const badge = getBadge(row.tokenId);
      const seg = holdingsLifecycleSeg(isListed, badge);
      if (seg !== "listed" && seg !== "notlisted") return false;
      const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
      return !isRedeemInFlight(redeemStatus);
    },
    [hiddenSet, segment, redeemStatusByTokenId],
  );

  const handleSetPrice = useCallback(
    (tokenId: number, draftPriceUsdc?: string | null) => {
      const row = assetRows.find((r) => r.tokenId === tokenId);
      const isListed =
        row != null &&
        row.listPriceUsd != null &&
        row.activeListingOrderHash != null;
      trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
        card_id: String(tokenId),
        current_price: row?.currentPrice ?? undefined,
      });
      onSetPrice(tokenId, draftPriceUsdc);
    },
    [assetRows, onSetPrice],
  );

  const listedRows = useMemo(
    () =>
      filteredSortedRows.filter(
        (row) => row.listPriceUsd != null && row.activeListingOrderHash != null,
      ),
    [filteredSortedRows],
  );

  const setSelectModeSafe = useCallback((on: boolean) => {
    setSelectMode(on);
    if (!on) setSelectedTokenIds(new Set());
  }, []);

  const toggleSelect = useCallback((tokenId: number) => {
    setSelectedTokenIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  }, []);

  const selectAllEligible = useCallback(() => {
    setSelectedTokenIds(
      new Set(
        filteredSortedRows.filter((r) => isSelectionEligible(r)).map((r) => r.tokenId),
      ),
    );
  }, [filteredSortedRows, isSelectionEligible]);

  const selectedListedCount = useMemo(() => {
    let n = 0;
    for (const id of selectedTokenIds) {
      const row = assetRows.find((r) => r.tokenId === id);
      if (
        row &&
        row.listPriceUsd != null &&
        row.activeListingOrderHash != null
      ) {
        n++;
      }
    }
    return n;
  }, [selectedTokenIds, assetRows]);

  const selectedHideCount = useMemo(() => {
    if (segment === "hidden") return selectedTokenIds.size;
    let n = 0;
    for (const id of selectedTokenIds) {
      const row = assetRows.find((r) => r.tokenId === id);
      const isListed =
        row != null &&
        row.listPriceUsd != null &&
        row.activeListingOrderHash != null;
      if (row && !isListed && !hiddenSet.has(id)) n++;
    }
    return n;
  }, [selectedTokenIds, assetRows, segment, hiddenSet]);

  const clearSelection = useCallback(() => {
    setSelectedTokenIds(new Set());
  }, []);

  const requestCancelSelected = useCallback(() => {
    if (!onRequestCancelListings || selectedTokenIds.size === 0) return;
    const items = listedRows
      .filter((row) => selectedTokenIds.has(row.tokenId))
      .map((row) => {
        const meta = metadataByTokenId.get(row.tokenId) ?? null;
        const headline = headlineByTokenId.get(row.tokenId);
        return {
          tokenId: row.tokenId,
          assetTitle: headline?.line1 ?? row.name,
          gradeLabel: formatPortfolioGradeLabel(meta),
          orderHash: row.activeListingOrderHash!,
          listPriceUsd: row.listPriceUsd ?? null,
        };
      });
    if (items.length === 0) return;
    onRequestCancelListings(items);
  }, [
    onRequestCancelListings,
    selectedTokenIds,
    listedRows,
    metadataByTokenId,
    headlineByTokenId,
  ]);

  const requestHideOrUnhideSelected = useCallback(async () => {
    const ids = [...selectedTokenIds];
    if (ids.length === 0) return;
    if (segment === "hidden") {
      await onBulkUnhide?.(ids);
    } else {
      const toHide = ids.filter((id) => {
        const row = assetRows.find((r) => r.tokenId === id);
        const isListed =
          row != null &&
          row.listPriceUsd != null &&
          row.activeListingOrderHash != null;
        return row && !isListed && !hiddenSet.has(id);
      });
      if (toHide.length === 0) return;
      await onBulkHide?.(toHide);
    }
    setSelectModeSafe(false);
  }, [
    selectedTokenIds,
    segment,
    onBulkHide,
    onBulkUnhide,
    assetRows,
    hiddenSet,
    setSelectModeSafe,
  ]);

  const clearToolbarFilters = useCallback(() => {
    setSort("newest");
    setSegment("all");
  }, []);

  if (assetsSectionLoading) {
    if (showGalleryGrid) {
      return (
        <div className="pf-gallery pf-gallery--skeleton" aria-hidden>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="pf-gallery__item">
              <div className="pf-gtile pf-gtile--skeleton">
                <div className="pf-gtile__media animate-pulse" />
                <div className="pf-gtile__body">
                  <div className="h-3 w-[80%] animate-pulse rounded bg-white/5" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                  <div className="h-6 w-2/3 animate-pulse rounded bg-white/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="pf-gallery pf-gallery--skeleton" aria-hidden>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="pf-gallery__item">
            <div className="pf-gtile pf-gtile--skeleton">
              <div className="pf-gtile__media animate-pulse" />
              <div className="pf-gtile__body">
                <div className="h-3 w-[80%] animate-pulse rounded bg-white/5" />
                <div className="h-8 w-full animate-pulse rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assetRows.length === 0) {
    return (
      <p className="pf-empty">
        No assets yet.{" "}
        <GatedSellLink className="hover:underline">Mint your first card</GatedSellLink>
      </p>
    );
  }

  const emptyFiltered = filteredSortedRows.length === 0;

  return (
    <>
      <PortfolioAssetsToolbar
        segment={segment}
        onSegmentChange={setSegment}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
        selectMode={selectMode}
        onSelectModeChange={setSelectModeSafe}
        selectedCount={selectedTokenIds.size}
        selectedListedCount={selectedListedCount}
        selectedHideCount={selectedHideCount}
        onSelectAll={selectAllEligible}
        onClearSelection={clearSelection}
        onCancelSelected={requestCancelSelected}
        onHideOrUnhideSelected={() => void requestHideOrUnhideSelected()}
        onClearFilters={clearToolbarFilters}
        hidingSelected={bulkHidePending}
        cancellingSelected={
          cancellingListingTokenId != null &&
          selectedTokenIds.has(cancellingListingTokenId)
        }
      />

      {emptyFiltered ? (
        <p className="pf-empty pf-empty--panel">
          {selectMode ? "Nothing to select in this view." : "Nothing in this segment."}
        </p>
      ) : showGalleryGrid ? (
        <div className="pf-gallery" role="list">
          {filteredSortedRows.map((row) => {
            const cost = costBasisByTokenId.get(row.tokenId);
            const headline = headlineByTokenId.get(row.tokenId);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
            const badge = getBadge(row.tokenId);
            const tradeBlocked = isRedeemInFlight(redeemStatus);
            const virtual = isKbwMysteryCardTokenId(row.tokenId);
            const kbwUsed = Boolean(row.kbwMysteryUsed);

            return (
              <div key={row.tokenId} className="pf-gallery__item" role="listitem">
                <PortfolioHoldingsGalleryTile
                  row={row}
                  headline={headline ?? null}
                  href={
                    virtual ? undefined : portfolioAssetHref(assetsBase, row.tokenId)
                  }
                  cost={cost}
                  valuesPending={valuesPending}
                  isListed={isListed}
                  redeemStatus={badge}
                  actionsDisabled={virtual || tradeBlocked}
                  actionsDisabledTitle={
                    virtual
                      ? kbwUsed
                        ? "Event collectible — already used"
                        : "Event collectible — not listable"
                      : tradeBlocked
                        ? "Redemption in progress"
                        : undefined
                  }
                  onSetPrice={handleSetPrice}
                  selectMode={selectMode && isSelectionEligible(row)}
                  selected={selectedTokenIds.has(row.tokenId)}
                  onToggleSelect={() => {
                    if (!isSelectionEligible(row)) return;
                    toggleSelect(row.tokenId);
                  }}
                  onActivate={
                    virtual && !kbwUsed && onOpenKbwMysteryCard
                      ? onOpenKbwMysteryCard
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <PortfolioHoldingsTableView
          rows={filteredSortedRows}
          costBasisByTokenId={costBasisByTokenId}
          costBasisSourceByTokenId={costBasisSourceByTokenId}
          valuesPending={valuesPending}
          onSetPrice={handleSetPrice}
          getBadge={getBadge}
          isTradeBlocked={(tokenId) =>
            isKbwMysteryCardTokenId(tokenId) ||
            isRedeemInFlight(redeemStatusByTokenId?.get(tokenId))
          }
          vaultByTokenId={vaultByTokenId}
          selectMode={selectMode}
          selectedTokenIds={selectedTokenIds}
          onToggleSelect={toggleSelect}
          isRowSelectable={isSelectionEligible}
          headlineByTokenId={headlineByTokenId}
          assetHrefBase={assetsBase}
          onOpenKbwMysteryCard={onOpenKbwMysteryCard}
        />
      )}

      {hasMoreAssets && onLoadMoreAssets ? (
        <div className="pf-load-more">
          {typeof loadedAssetCount === "number" &&
          typeof totalAssetCount === "number" &&
          totalAssetCount > 0 ? (
            <p className="pf-load-more__meta">
              Showing {loadedAssetCount} of {totalAssetCount}
            </p>
          ) : null}
          <TkButton
            type="button"
            variant="subtle"
            size="sm"
            className="pf-load-more__btn"
            disabled={isLoadingMoreAssets}
            onClick={onLoadMoreAssets}
          >
            {isLoadingMoreAssets ? "Loading…" : "Load more"}
          </TkButton>
        </div>
      ) : null}
    </>
  );
}
