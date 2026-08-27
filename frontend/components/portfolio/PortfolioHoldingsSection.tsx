"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order, RwaMetadata } from "@/lib/core";
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
} from "@/lib/portfolio/portfolioTableHelpers";
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
  redeemStatusByTokenId,
  redeemTrackingByTokenId,
  redeemCarrierDeliveredByTokenId,
  hasMoreAssets = false,
  isLoadingMoreAssets = false,
  onLoadMoreAssets,
  loadedAssetCount,
  totalAssetCount,
  vaultLabelByTokenId,
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
  redeemStatusByTokenId?: Map<number, string>;
  redeemTrackingByTokenId?: Map<number, string>;
  redeemCarrierDeliveredByTokenId?: Map<number, string>;
  hasMoreAssets?: boolean;
  isLoadingMoreAssets?: boolean;
  onLoadMoreAssets?: () => void;
  loadedAssetCount?: number;
  totalAssetCount?: number;
  vaultLabelByTokenId?: Map<number, string>;
}) {
  const [segment, setSegment] = useState<AssetsSegment>("tradeable");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<AssetsToolbarSort>("value");
  /** Mobile (≤768) defaults to row cards like Portfolio.html `.mobile-asset-cards`. */
  const [view, setView] = useState<AssetsViewMode>("table");
  const isMobile = useIsMobileViewport(768);
  const pathname = usePathname();
  const assetsBase = portfolioBasePath(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 769px)").matches) setView("gallery");
  }, []);

  function getBadge(tokenId: number) {
    return redeemSurfaceBadge(
      redeemStatusByTokenId?.get(tokenId),
      redeemTrackingByTokenId?.get(tokenId),
      redeemCarrierDeliveredByTokenId?.get(tokenId),
    );
  }

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
      const hay = `${row.name} ${cert} ${grade} ${set}`.toLowerCase();
      return hay.includes(q);
    });

    rows.sort((a, b) => {
      const costA = costBasisByTokenId.get(a.tokenId);
      const costB = costBasisByTokenId.get(b.tokenId);
      switch (sort) {
        case "newest": {
          const tA = Date.parse(acquiredAtByTokenId?.get(a.tokenId) ?? "") || 0;
          const tB = Date.parse(acquiredAtByTokenId?.get(b.tokenId) ?? "") || 0;
          if (tA !== tB) return tB - tA;
          return b.tokenId - a.tokenId;
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
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        sort={sort}
        onSortChange={setSort}
        view={view}
        onViewChange={setView}
      />

      {emptyFiltered ? (
        <p className="pf-empty pf-empty--panel">Nothing in this segment.</p>
      ) : view === "gallery" ? (
        <div className="pf-gallery" role="list">
          {filteredSortedRows.map((row) => {
            const meta = metadataByTokenId.get(row.tokenId) ?? null;
            const grade = formatPortfolioGradeLabel(meta);
            const cost = costBasisByTokenId.get(row.tokenId);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
            const badge = getBadge(row.tokenId);
            const tradeBlocked = isRedeemInFlight(redeemStatus);

            return (
              <div key={row.tokenId} className="pf-gallery__item" role="listitem">
                <PortfolioHoldingsGalleryTile
                  row={row}
                  href={portfolioAssetHref(assetsBase, row.tokenId)}
                  grade={grade}
                  cost={cost}
                  vaultLabel={vaultLabelByTokenId?.get(row.tokenId) ?? "PSA Vault"}
                  valuesPending={valuesPending}
                  canEditCostBasis={Boolean(canEditCostBasis && onSaveCostBasis)}
                  savingCostBasis={savingCostBasisTokenId === row.tokenId}
                  isListed={isListed}
                  redeemStatus={badge}
                  actionsDisabled={tradeBlocked}
                  actionsDisabledTitle={
                    tradeBlocked
                      ? "Redemption in progress — listing unavailable"
                      : undefined
                  }
                  onSaveCostBasis={
                    onSaveCostBasis
                      ? (usd) => onSaveCostBasis(row.tokenId, usd)
                      : undefined
                  }
                  onSetPrice={() => {
                    trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
                      card_id: String(row.tokenId),
                      current_price: row.currentPrice ?? undefined,
                    });
                    onSetPrice(row.tokenId);
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : isMobile ? (
        <div className="pf-mobile-asset-cards" role="list">
          {filteredSortedRows.map((row) => {
            const meta = metadataByTokenId.get(row.tokenId) ?? null;
            const grade = formatPortfolioGradeLabel(meta);
            const cost = costBasisByTokenId.get(row.tokenId);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
            const badge = getBadge(row.tokenId);
            const tradeBlocked = isRedeemInFlight(redeemStatus);

            return (
              <PortfolioMobileAssetCard
                key={row.tokenId}
                row={row}
                href={portfolioAssetHref(assetsBase, row.tokenId)}
                grade={grade}
                cost={cost}
                valuesPending={valuesPending}
                canEditCostBasis={Boolean(canEditCostBasis && onSaveCostBasis)}
                savingCostBasis={savingCostBasisTokenId === row.tokenId}
                isListed={isListed}
                redeemStatus={badge}
                actionsDisabled={tradeBlocked}
                actionsDisabledTitle={
                  tradeBlocked
                    ? "Redemption in progress — listing unavailable"
                    : undefined
                }
                onSaveCostBasis={
                  onSaveCostBasis
                    ? (usd) => onSaveCostBasis(row.tokenId, usd)
                    : undefined
                }
                onSetPrice={() => {
                  trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
                    card_id: String(row.tokenId),
                    current_price: row.currentPrice ?? undefined,
                  });
                  onSetPrice(row.tokenId);
                }}
              />
            );
          })}
        </div>
      ) : (
        <PortfolioHoldingsTableView
          rows={filteredSortedRows}
          assetHrefBase={assetsBase}
          metadataByTokenId={metadataByTokenId}
          costBasisByTokenId={costBasisByTokenId}
          vaultLabelByTokenId={vaultLabelByTokenId}
          valuesPending={valuesPending}
          canEditCostBasis={Boolean(canEditCostBasis && onSaveCostBasis)}
          savingCostBasisTokenId={savingCostBasisTokenId}
          onSaveCostBasis={onSaveCostBasis}
          onSetPrice={(tokenId) => {
            const row = filteredSortedRows.find((r) => r.tokenId === tokenId);
            const isListed =
              row != null &&
              row.listPriceUsd != null &&
              row.activeListingOrderHash != null;
            trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
              card_id: String(tokenId),
              current_price: row?.currentPrice ?? undefined,
            });
            onSetPrice(tokenId);
          }}
          getBadge={getBadge}
          isTradeBlocked={(tokenId) =>
            isRedeemInFlight(redeemStatusByTokenId?.get(tokenId))
          }
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
