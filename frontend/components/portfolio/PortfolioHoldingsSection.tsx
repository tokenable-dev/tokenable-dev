"use client";

import { useMemo } from "react";
import type { CollectionMarketSeries, RwaMetadata } from "@/lib/core";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import { GatedSellLink } from "@/components/auth/GatedSellLink";
import { TkButton, TkTable } from "@/components/ds";
import { usePortfolioTableSort } from "@/hooks/portfolio/usePortfolioTableSort";
import {
  compareSortNum,
  compareSortText,
  extractSparklineValues,
  formatPortfolioGradeLabel,
  formatPortfolioPnl,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioMobileSort } from "./PortfolioMobileSort";
import { PortfolioSortableTh } from "./PortfolioSortableTh";
import { PortfolioTrendSparkline } from "./PortfolioTrendSparkline";

type HoldingsSortKey = "name" | "grade" | "cost" | "value" | "pl";

const HOLDINGS_SORT_OPTIONS = [
  { key: "name", label: "Card" },
  { key: "grade", label: "Grade" },
  { key: "cost", label: "Cost basis" },
  { key: "value", label: "Current value" },
  { key: "pl", label: "P/L" },
] as const;

export function PortfolioHoldingsSection({
  assetsSectionLoading,
  assetRows,
  metadataByTokenId,
  tokenToCollectionKey,
  seriesByCollectionKey,
  costBasisByTokenId,
  valuesPending,
  canEditCostBasis,
  onEditCostBasis,
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
  onEditCostBasis?: (tokenId: number, currentUsd: number | null) => void;
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

      <TkTable wrapClassName="pf-table-wrap" className="pf-table--holdings">
        <colgroup>
          <col className="pf-col-card" />
          <col className="pf-col-grade" />
          <col className="pf-col-cost" />
          <col className="pf-col-value" />
          <col className="pf-col-trend" />
          <col className="pf-col-pl" />
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
              label="Current value"
              sortKey="value"
              activeKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={(k) => toggleSort(k as HoldingsSortKey)}
            />
            <th className="pf-col-trend-head">Trend</th>
            <PortfolioSortableTh
              label="P/L"
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
          {sortedRows.map((row, index) => {
            const meta = metadataByTokenId.get(row.tokenId) ?? null;
            const grade = formatPortfolioGradeLabel(meta);
            const cost = costBasisByTokenId.get(row.tokenId);
            const pnl = formatPortfolioPnl(cost, row.currentPrice);
            const ck = tokenToCollectionKey[row.tokenId]?.toLowerCase();
            const series = ck ? seriesByCollectionKey.get(ck) : undefined;
            const spark = extractSparklineValues(series);
            const isListed =
              row.listPriceUsd != null && row.activeListingOrderHash != null;
            const zebra = index % 2 === 1 ? "pf-table-row--zebra" : undefined;

            return (
              <tr
                key={row.tokenId}
                className={zebra}
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
                  {grade ? <span className="pf-grade-chip">{grade}</span> : "—"}
                </td>
                <td data-label="Cost basis" className="pf-col-num-cell">
                  <div
                    className="pf-cost-basis-cell"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span className="tkl-mono pf-table-muted">
                      {formatPortfolioUsd(cost)}
                    </span>
                    {canEditCostBasis && onEditCostBasis ? (
                      <button
                        type="button"
                        className="pf-cost-basis-edit"
                        aria-label={`Edit cost basis for ${row.name}`}
                        onClick={() => onEditCostBasis(row.tokenId, cost ?? null)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                </td>
                <td data-label="Current value" className="pf-col-num-cell">
                  <span className="tkl-mono pf-table-strong">
                    {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
                  </span>
                </td>
                <td data-label="Trend" className="pf-col-trend-cell">
                  <PortfolioTrendSparkline values={spark} />
                </td>
                <td data-label="P/L" className="pf-col-num-cell pf-col-pl-cell">
                  {pnl ? (
                    <span
                      className={`tkl-mono pf-table-pl ${pnl.positive ? "pf-table-pl--pos" : "pf-table-pl--neg"}`}
                    >
                      {pnl.label}
                    </span>
                  ) : (
                    <span className="tkl-mono pf-table-muted">—</span>
                  )}
                </td>
                <td data-label="Action" className="pf-col-action-cell">
                  <div
                    className="pf-table-actions"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {isListed ? (
                      <>
                        <span className="tkl-mono pf-table-listed">
                          Listed {formatPortfolioUsd(row.listPriceUsd)}
                        </span>
                        <TkButton
                          type="button"
                          variant="neutral"
                          size="sm"
                          className="pf-table-btn"
                          disabled={cancellingListingTokenId === row.tokenId}
                          onClick={() =>
                            onCancelListing(row.tokenId, row.activeListingOrderHash!)
                          }
                        >
                          {cancellingListingTokenId === row.tokenId ? "…" : "Cancel"}
                        </TkButton>
                      </>
                    ) : (
                      <>
                        <TkButton
                          type="button"
                          variant="neutral"
                          size="sm"
                          className="pf-table-btn"
                          onClick={() => onChangeListing(row.tokenId)}
                        >
                          List
                        </TkButton>
                        <TkButton
                          type="button"
                          variant="primary"
                          size="sm"
                          className="pf-table-btn"
                          onClick={() => onSellNow(row.tokenId)}
                        >
                          Sell Now
                        </TkButton>
                      </>
                    )}
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
