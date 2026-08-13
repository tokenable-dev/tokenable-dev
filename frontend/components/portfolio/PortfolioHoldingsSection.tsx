"use client";

import { useMemo } from "react";
import type { Order, RwaMetadata } from "@/lib/core";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  isRedeemInFlight,
  redeemSurfaceBadge,
} from "@/lib/portfolio/redeemDraft";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { TkButton, TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import { highestBidUsdForHolding } from "@/hooks/portfolio/usePortfolioCollectionTopBids";
import {
  compareSortNum,
  compareSortText,
  formatPortfolioGradeLabel,
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioMobileAssetCard } from "./PortfolioMobileAssetCard";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh, PortfolioStaticTh } from "./PortfolioSortableTh";
import { RedeemSelectModeBar } from "./redeem/RedeemSelectModeBar";

type HoldingsSortKey = "name" | "grade" | "cost" | "value" | "pl";

const HOLDINGS_SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "grade", label: "Grade" },
  { key: "cost", label: "Cost basis" },
  { key: "value", label: "Mkt Price" },
  { key: "pl", label: "P/L" },
] as const;

export function PortfolioHoldingsSection({
  assetsSectionLoading,
  assetRows,
  metadataByTokenId,
  tokenToCollectionKey,
  bidsByCollectionKey,
  costBasisByTokenId,
  valuesPending,
  canEditCostBasis,
  onSaveCostBasis,
  savingCostBasisTokenId,
  onOpenToken,
  onSetPrice,
  redeemSelectMode = false,
  redeemSelected,
  redeemEligibleIds,
  redeemLimitError = null,
  redeemStatusByTokenId,
  redeemTrackingByTokenId,
  onExitRedeemSelect,
  onToggleRedeemToken,
  onContinueRedeem,
  redeemMaxBatch = 50,
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
  valuesPending: boolean;
  canEditCostBasis?: boolean;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  savingCostBasisTokenId?: number | null;
  onOpenToken: (tokenId: number) => void;
  onSetPrice: (tokenId: number) => void;
  redeemSelectMode?: boolean;
  redeemSelected?: Set<number>;
  redeemEligibleIds?: Set<number>;
  redeemLimitError?: string | null;
  redeemStatusByTokenId?: Map<number, string>;
  redeemTrackingByTokenId?: Map<number, string>;
  hasMoreAssets?: boolean;
  isLoadingMoreAssets?: boolean;
  onLoadMoreAssets?: () => void;
  loadedAssetCount?: number;
  totalAssetCount?: number;
  onExitRedeemSelect?: () => void;
  onToggleRedeemToken?: (tokenId: number, checked: boolean) => void;
  onContinueRedeem?: () => void;
  redeemMaxBatch?: number;
  /** tokenId → "PSA Vault" | "{partner} vault" */
  vaultLabelByTokenId?: Map<number, string>;
}) {
  const { sortKey, sortDir, toggleSort, applyMobileSort, mobileSortValue } =
    usePortfolioTableSort<HoldingsSortKey>("name");

  const sortedRows = useMemo(() => {
    const rows = [...assetRows];
    rows.sort((a, b) => {
      const metaA = metadataByTokenId.get(a.tokenId) ?? null;
      const metaB = metadataByTokenId.get(b.tokenId) ?? null;
      const gradeA = formatPortfolioGradeLabel(metaA) ?? "";
      const gradeB = formatPortfolioGradeLabel(metaB) ?? "";
      const costA = costBasisByTokenId.get(a.tokenId);
      const costB = costBasisByTokenId.get(b.tokenId);

      switch (sortKey) {
        case "grade":
          return compareSortText(gradeA, gradeB, sortDir);
        case "cost":
          return compareSortNum(costA, costB, sortDir);
        case "value":
          return compareSortNum(a.currentPrice, b.currentPrice, sortDir);
        case "pl": {
          const deltaA =
            costA != null && a.currentPrice != null ? a.currentPrice - costA : null;
          const deltaB =
            costB != null && b.currentPrice != null ? b.currentPrice - costB : null;
          return compareSortNum(deltaA, deltaB, sortDir);
        }
        default:
          return compareSortText(a.name, b.name, sortDir);
      }
    });
    return rows;
  }, [assetRows, sortKey, sortDir, metadataByTokenId, costBasisByTokenId]);

  if (assetsSectionLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
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

  const selectedCount = redeemSelected?.size ?? 0;

  return (
    <>
      {redeemSelectMode ? (
        <div
          className={`pf-redeem-hint${redeemLimitError ? " pf-redeem-hint--err" : ""}`}
          role="status"
        >
          {redeemLimitError ??
            `Select up to ${redeemMaxBatch} cards to redeem together. One shipping fee covers the whole batch.`}
        </div>
      ) : null}

      <PortfolioMobileSort
        options={[...HOLDINGS_SORT_OPTIONS]}
        value={mobileSortValue}
        onChange={applyMobileSort}
      />

      <div className="pf-mobile-asset-cards">
        {sortedRows.map((row) => {
          const meta = metadataByTokenId.get(row.tokenId) ?? null;
          const grade = formatPortfolioGradeLabel(meta);
          const cost = costBasisByTokenId.get(row.tokenId);
          const isListed =
            row.listPriceUsd != null && row.activeListingOrderHash != null;
          const ck = tokenToCollectionKey[row.tokenId];
          const highestBidUsd = ck
            ? highestBidUsdForHolding(bidsByCollectionKey.get(ck), row.tokenId)
            : null;
          const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
          const badge = redeemSurfaceBadge(
            redeemStatus,
            redeemTrackingByTokenId?.get(row.tokenId),
          );
          const tradeBlocked = isRedeemInFlight(redeemStatus);
          const selectable = redeemEligibleIds?.has(row.tokenId) ?? false;

          return (
            <PortfolioMobileAssetCard
              key={row.tokenId}
              row={row}
              grade={grade}
              cost={cost}
              valuesPending={valuesPending}
              canEditCostBasis={Boolean(canEditCostBasis && onSaveCostBasis)}
              savingCostBasis={savingCostBasisTokenId === row.tokenId}
              isListed={isListed}
              highestBidUsd={highestBidUsd}
              selectMode={redeemSelectMode}
              selected={redeemSelected?.has(row.tokenId) ?? false}
              selectable={selectable}
              redeemStatus={badge}
              actionsDisabled={tradeBlocked || redeemSelectMode}
              actionsDisabledTitle={
                tradeBlocked
                  ? "Redemption in progress — listing unavailable"
                  : undefined
              }
              onToggleSelect={(checked) =>
                onToggleRedeemToken?.(row.tokenId, checked)
              }
              onOpen={() => onOpenToken(row.tokenId)}
              onSaveCostBasis={
                onSaveCostBasis ? (usd) => onSaveCostBasis(row.tokenId, usd) : undefined
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

      <TkTable wrapClassName="pf-table-wrap pf-holdings-table-wrap" className="pf-table--holdings">
        <colgroup>
          <col className="pf-col-card" />
          <col className="pf-col-grade" />
          <col className="pf-col-cost" />
          <col className="pf-col-value" />
          <col className="pf-col-profit" />
          <col className="pf-col-return" />
          <col className="pf-col-action" />
        </colgroup>
        <thead>
          <tr>
            <PortfolioSortableTh
              label="Card"
              sortKey="name"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioSortableTh
              label="Grade"
              sortKey="grade"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioSortableTh
              label="Cost basis"
              sortKey="cost"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioSortableTh
              label="Mkt Price"
              sortKey="value"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioSortableTh
              label="Profit"
              sortKey="pl"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioSortableTh
              label="Return"
              sortKey="pl"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <PortfolioStaticTh label="Action" align="right" muted />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const meta = metadataByTokenId.get(row.tokenId) ?? null;
            const grade = formatPortfolioGradeLabel(meta);
            const cost = costBasisByTokenId.get(row.tokenId);
            const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const ck = tokenToCollectionKey[row.tokenId];
            const highestBidUsd = ck
              ? highestBidUsdForHolding(bidsByCollectionKey.get(ck), row.tokenId)
              : null;
            const plClass = pnl
              ? pnl.positive
                ? "pf-table-pl--pos"
                : "pf-table-pl--neg"
              : "";
            const redeemStatus = redeemStatusByTokenId?.get(row.tokenId) ?? null;
            const badge = redeemSurfaceBadge(
              redeemStatus,
              redeemTrackingByTokenId?.get(row.tokenId),
            );
            const tradeBlocked = isRedeemInFlight(redeemStatus);
            const selectable = redeemEligibleIds?.has(row.tokenId) ?? false;
            const selected = redeemSelected?.has(row.tokenId) ?? false;
            const costEditable =
              Boolean(canEditCostBasis && onSaveCostBasis) &&
              !redeemSelectMode &&
              !tradeBlocked;

            return (
              <tr
                key={row.tokenId}
                className={[
                  redeemSelectMode && selected ? "pf-holdings-row--selected" : null,
                  badge?.kind === "transit" ? "pf-holdings-row--transit" : null,
                  badge?.kind === "possession" ? "pf-holdings-row--possession" : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined}
                onClick={() => {
                  if (redeemSelectMode) {
                    if (selectable) onToggleRedeemToken?.(row.tokenId, !selected);
                    return;
                  }
                  onOpenToken(row.tokenId);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (redeemSelectMode) {
                      if (selectable) onToggleRedeemToken?.(row.tokenId, !selected);
                      return;
                    }
                    onOpenToken(row.tokenId);
                  }
                }}
                tabIndex={0}
                role="link"
              >
                <td data-label="Card">
                  <div className="pf-table-card-cell">
                    {redeemSelectMode ? (
                      <span
                        className="pf-redeem-chk-cell"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="pf-redeem-chk"
                          checked={selected}
                          disabled={!selectable}
                          title={
                            selectable
                              ? "Select for redeem"
                              : isListed
                                ? "Cancel listing before redeeming"
                                : tradeBlocked
                                  ? "Already in a redemption"
                                  : "Not eligible for redeem"
                          }
                          onChange={(e) =>
                            onToggleRedeemToken?.(row.tokenId, e.target.checked)
                          }
                          aria-label={`Select ${row.name} for redeem`}
                        />
                      </span>
                    ) : null}
                    <div className="pf-table-thumb">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt="" />
                      ) : null}
                    </div>
                    <span className="pf-table-card-name" title={row.name}>
                      {row.name}
                    </span>
                  </div>
                </td>
                <td data-label="Grade" className="pf-col-grade-cell">
                  {grade ? (
                    <span className="pf-grade-vault">
                      <TkTag tone="neutral" appearance="soft">
                        {grade}
                      </TkTag>
                      <span className="pf-vault-chip">
                        {vaultLabelByTokenId?.get(row.tokenId) ?? "PSA Vault"}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td data-label="Cost basis" className="pf-col-num-cell">
                  <div
                    className="pf-cost-basis-cell-wrap"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <PortfolioCostBasisInlineEdit
                      layout="desktop"
                      assetName={row.name}
                      valueUsd={cost}
                      editable={costEditable}
                      saving={savingCostBasisTokenId === row.tokenId}
                      showMintPriceNote={Boolean(costEditable && cost != null)}
                      onSave={(usd) => void onSaveCostBasis?.(row.tokenId, usd)}
                    />
                  </div>
                </td>
                <td data-label="Mkt Price" className="pf-col-num-cell">
                  <span className="tkl-mono pf-table-strong">
                    {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
                  </span>
                </td>
                <td data-label="Profit" className="pf-col-num-cell">
                  {pnl ? (
                    <span className={`tkl-mono pf-table-pl ${plClass}`}>{pnl.profit}</span>
                  ) : (
                    <span className="tkl-mono pf-table-muted">—</span>
                  )}
                </td>
                <td data-label="Return" className="pf-col-return-cell">
                  {pnl ? (
                    <span className={`tkl-mono pf-table-pl pf-table-return ${plClass}`}>
                      {pnl.returnPct}
                    </span>
                  ) : (
                    <span className="tkl-mono pf-table-muted">—</span>
                  )}
                </td>
                <td data-label="Action" className="pf-col-action-cell">
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {redeemSelectMode && !badge ? (
                      <span className="tkl-mono pf-table-muted">—</span>
                    ) : (
                      <PortfolioHoldingsRowActions
                        isListed={isListed}
                        highestBidUsd={highestBidUsd}
                        redeemStatus={badge}
                        onSetPrice={() => {
                          trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
                            card_id: String(row.tokenId),
                            current_price: row.currentPrice ?? undefined,
                          });
                          onSetPrice(row.tokenId);
                        }}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TkTable>

      {hasMoreAssets && onLoadMoreAssets && !redeemSelectMode ? (
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

      {redeemSelectMode && onExitRedeemSelect && onContinueRedeem ? (
        <RedeemSelectModeBar
          selectedCount={selectedCount}
          maxBatch={redeemMaxBatch}
          limitError={redeemLimitError}
          onCancel={onExitRedeemSelect}
          onContinue={onContinueRedeem}
        />
      ) : null}
    </>
  );
}
