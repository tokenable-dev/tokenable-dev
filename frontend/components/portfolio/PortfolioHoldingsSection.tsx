"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Order, RwaMetadata } from "@/lib/core";
import { postRwaVaultInfoBatch, rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  certNumberFromMetadata,
  isRedeemInFlight,
  redeemSurfaceBadge,
} from "@/lib/portfolio/redeemDraft";
import {
  holdingsLifecycleSeg,
  matchesAssetsSegment,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";
import {
  compareSortNum,
  compareSortText,
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
import { PortfolioMobileAssetCard } from "./PortfolioMobileAssetCard";
export function PortfolioHoldingsSection({
  assetsSectionLoading,
  assetRows,
  metadataByTokenId,
  tokenToCollectionKey: _tokenToCollectionKey,
  bidsByCollectionKey: _bidsByCollectionKey,
  costBasisByTokenId,
  acquiredAtByTokenId,
  valuesPending,
  canEditCostBasis,
  onSaveCostBasis,
  savingCostBasisTokenId,
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
}: {
  assetsSectionLoading: boolean;
  assetRows: AssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  tokenToCollectionKey: Record<number, string>;
  bidsByCollectionKey: Map<string, Order[]>;
  costBasisByTokenId: Map<number, number>;
  acquiredAtByTokenId?: Map<number, string>;
  valuesPending: boolean;
  canEditCostBasis?: boolean;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  savingCostBasisTokenId?: number | null;
  onSetPrice: (tokenId: number) => void;
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
}) {
  const [segment, setSegment] = useState<AssetsSegment>("tradeable");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<AssetsToolbarSort>("newest");
  /** Default: gallery tiles on mobile and desktop (table is opt-in). */
  const [view, setView] = useState<AssetsViewMode>("gallery");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTokenIds, setSelectedTokenIds] = useState<Set<number>>(() => new Set());
  const isMobile = useIsMobileViewport(768);
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
    () => assetRows.map((r) => r.tokenId),
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
    const q = searchQuery.trim().toLowerCase();
    const rows = assetRows.filter((row) => {
      const isListed =
        row.listPriceUsd != null && row.activeListingOrderHash != null;
      const badge = getBadge(row.tokenId);
      const seg = holdingsLifecycleSeg(isListed, badge);
      if (!matchesAssetsSegment(seg, segment)) return false;
      if (!q) return true;
      const meta = metadataByTokenId.get(row.tokenId) ?? null;
      const cert = certNumberFromMetadata(meta)?.toLowerCase() ?? "";
      const grade = formatPortfolioGradeLabel(meta)?.toLowerCase() ?? "";
      const set = (row.setName ?? "").toLowerCase();
      const headline = headlineByTokenId.get(row.tokenId);
      const hay = `${headline?.line1 ?? row.name} ${cert} ${grade} ${set}`.toLowerCase();
      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const costA = costBasisByTokenId.get(a.tokenId);
      const costB = costBasisByTokenId.get(b.tokenId);
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
        case "name":
          return compareSortText(a.name, b.name, "asc");
        case "pl": {
          const dA =
            costA != null && a.currentPrice != null ? a.currentPrice - costA : null;
          const dB =
            costB != null && b.currentPrice != null ? b.currentPrice - costB : null;
          return compareSortNum(dA, dB, "desc");
        }
        case "ret": {
          const rA =
            costA != null && costA > 0 && a.currentPrice != null
              ? (a.currentPrice - costA) / costA
              : null;
          const rB =
            costB != null && costB > 0 && b.currentPrice != null
              ? (b.currentPrice - costB) / costB
              : null;
          return compareSortNum(rA, rB, "desc");
        }
        case "value":
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
    searchQuery,
    sort,
    metadataByTokenId,
    costBasisByTokenId,
    acquiredAtByTokenId,
    redeemStatusByTokenId,
    redeemTrackingByTokenId,
    redeemCarrierDeliveredByTokenId,
    redeemPaymentBatchByTokenId,
    headlineByTokenId,
  ]);

  const handleSetPrice = useCallback(
    (tokenId: number) => {
      const row = assetRows.find((r) => r.tokenId === tokenId);
      const isListed =
        row != null &&
        row.listPriceUsd != null &&
        row.activeListingOrderHash != null;
      trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
        card_id: String(tokenId),
        current_price: row?.currentPrice ?? undefined,
      });
      onSetPrice(tokenId);
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

  useEffect(() => {
    if (!selectMode) return;
    const listed = new Set(listedRows.map((r) => r.tokenId));
    setSelectedTokenIds((prev) => {
      let changed = false;
      const next = new Set<number>();
      for (const id of prev) {
        if (listed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectMode, listedRows]);

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

  const selectAllListed = useCallback(() => {
    setSelectedTokenIds(new Set(listedRows.map((r) => r.tokenId)));
  }, [listedRows]);

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

  if (assetsSectionLoading) {
    if (view === "gallery" && !isMobile) {
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
      <div className="pf-mobile-asset-cards" aria-hidden>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="pf-mobile-asset-card pf-mobile-asset-card--skeleton">
            <div className="pf-mobile-asset-card__img animate-pulse" />
            <div className="pf-mobile-asset-card__info">
              <div className="h-4 w-[85%] animate-pulse rounded bg-white/8" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
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
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
        selectMode={selectMode}
        onSelectModeChange={setSelectModeSafe}
        selectedCount={selectedTokenIds.size}
        onSelectAll={selectAllListed}
        onClearSelection={clearSelection}
        onCancelSelected={requestCancelSelected}
        cancellingSelected={
          cancellingListingTokenId != null &&
          selectedTokenIds.has(cancellingListingTokenId)
        }
      />

      {emptyFiltered ? (
        <p className="pf-empty pf-empty--panel">
          {selectMode ? "No active listings." : "Nothing in this segment."}
        </p>
      ) : view === "gallery" ? (
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
                  canEditCostBasis={
                    !virtual && Boolean(canEditCostBasis && onSaveCostBasis)
                  }
                  savingCostBasis={savingCostBasisTokenId === row.tokenId}
                  isListed={isListed}
                  redeemStatus={badge}
                  actionsDisabled={virtual || tradeBlocked}
                  actionsDisabledTitle={
                    virtual
                      ? "Event collectible — not listable"
                      : tradeBlocked
                        ? "Redemption in progress"
                        : undefined
                  }
                  onSaveCostBasis={onSaveCostBasis}
                  onSetPrice={handleSetPrice}
                  selectMode={selectMode && !virtual}
                  selected={selectedTokenIds.has(row.tokenId)}
                  onToggleSelect={() => toggleSelect(row.tokenId)}
                  onActivate={
                    virtual && onOpenKbwMysteryCard
                      ? onOpenKbwMysteryCard
                      : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      ) : isMobile ? (
        <div className="pf-mobile-asset-cards" role="list">
          {filteredSortedRows.map((row) => {
            const cost = costBasisByTokenId.get(row.tokenId);
            const headline = headlineByTokenId.get(row.tokenId);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
            const badge = getBadge(row.tokenId);
            const tradeBlocked = isRedeemInFlight(redeemStatus);
            const virtual = isKbwMysteryCardTokenId(row.tokenId);

            return (
              <PortfolioMobileAssetCard
                key={row.tokenId}
                row={row}
                headline={headline ?? null}
                href={
                  virtual ? undefined : portfolioAssetHref(assetsBase, row.tokenId)
                }
                cost={cost}
                valuesPending={valuesPending}
                canEditCostBasis={
                  !virtual && Boolean(canEditCostBasis && onSaveCostBasis)
                }
                savingCostBasis={savingCostBasisTokenId === row.tokenId}
                isListed={isListed}
                redeemStatus={badge}
                actionsDisabled={virtual || tradeBlocked}
                actionsDisabledTitle={
                  virtual
                    ? "Event collectible — not listable"
                    : tradeBlocked
                      ? "Redemption in progress — listing unavailable"
                      : undefined
                }
                onSaveCostBasis={onSaveCostBasis}
                onSetPrice={handleSetPrice}
                selectMode={selectMode && !virtual}
                selected={selectedTokenIds.has(row.tokenId)}
                onToggleSelect={() => toggleSelect(row.tokenId)}
                onActivate={
                  virtual && onOpenKbwMysteryCard
                    ? onOpenKbwMysteryCard
                    : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <PortfolioHoldingsTableView
          rows={filteredSortedRows}
          costBasisByTokenId={costBasisByTokenId}
          valuesPending={valuesPending}
          canEditCostBasis={Boolean(canEditCostBasis && onSaveCostBasis)}
          savingCostBasisTokenId={savingCostBasisTokenId}
          onSaveCostBasis={onSaveCostBasis}
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
