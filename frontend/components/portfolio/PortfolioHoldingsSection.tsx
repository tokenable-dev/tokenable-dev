"use client";

import { useMemo } from "react";
import type { CollectionMarketSeries, RwaMetadata } from "@/lib/core";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { TkTable, TkTag } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
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
import { PortfolioSortableTh } from "./PortfolioSortableTh";

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
  costBasisByTokenId,
  valuesPending,
  canEditCostBasis,
  onSaveCostBasis,
  savingCostBasisTokenId,
  cancellingListingTokenId,
  onOpenToken,
  onChangeListing,
  onCancelListing,
  onSellNow,
}: {
  assetsSectionLoading: boolean;
  assetRows: AssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  tokenToCollectionKey: Record<number, string>;
  seriesByCollectionKey: Map<string, CollectionMarketSeries>;
  costBasisByTokenId: Map<number, number>;
  valuesPending: boolean;
  canEditCostBasis?: boolean;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  savingCostBasisTokenId?: number | null;
  cancellingListingTokenId: number | null;
  onOpenToken: (tokenId: number) => void;
  onChangeListing: (tokenId: number) => void;
  onCancelListing: (tokenId: number, orderHash: string) => void;
  onSellNow: (tokenId: number) => void;
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

  return (
    <>
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
              cancelling={cancellingListingTokenId === row.tokenId}
              onOpen={() => onOpenToken(row.tokenId)}
              onSaveCostBasis={
                onSaveCostBasis ? (usd) => onSaveCostBasis(row.tokenId, usd) : undefined
              }
              onList={() => {
                trackEvent("list_clicked", {
                  card_id: String(row.tokenId),
                  current_price: row.currentPrice ?? undefined,
                });
                onChangeListing(row.tokenId);
              }}
              onCancel={() =>
                onCancelListing(row.tokenId, row.activeListingOrderHash!)
              }
              onSellNow={() => {
                trackEvent("sell_now_clicked", {
                  card_id: String(row.tokenId),
                });
                onSellNow(row.tokenId);
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
            <th className="pf-col-action-head">Action</th>
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
            const plClass = pnl
              ? pnl.positive
                ? "pf-table-pl--pos"
                : "pf-table-pl--neg"
              : "";

            return (
              <tr
                key={row.tokenId}
                onClick={() => onOpenToken(row.tokenId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenToken(row.tokenId);
                  }
                }}
                tabIndex={0}
                role="link"
              >
                <td data-label="Card">
                  <div className="pf-table-card-cell">
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
                    <TkTag tone="neutral" appearance="soft">
                      {grade}
                    </TkTag>
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
                      editable={Boolean(canEditCostBasis && onSaveCostBasis)}
                      saving={savingCostBasisTokenId === row.tokenId}
                      showMintPriceNote={Boolean(canEditCostBasis && cost != null)}
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
                    <PortfolioHoldingsRowActions
                      isListed={isListed}
                      cancelling={cancellingListingTokenId === row.tokenId}
                      onList={() => {
                        trackEvent("list_clicked", {
                          card_id: String(row.tokenId),
                          current_price: row.currentPrice ?? undefined,
                        });
                        onChangeListing(row.tokenId);
                      }}
                      onCancel={() =>
                        onCancelListing(row.tokenId, row.activeListingOrderHash!)
                      }
                      onSellNow={() => {
                        trackEvent("sell_now_clicked", {
                          card_id: String(row.tokenId),
                        });
                        onSellNow(row.tokenId);
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TkTable>
    </>
  );
}
