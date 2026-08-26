"use client";

import Link from "next/link";
import type { RwaMetadata } from "@/lib/core";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioGradeLabel,
  formatPortfolioGradeSubtitle,
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioStaticTh } from "./PortfolioSortableTh";

/** Portfolio.html `#pf-tableview` — My Assets table layout. */
export function PortfolioHoldingsTableView({
  rows,
  metadataByTokenId,
  costBasisByTokenId,
  vaultLabelByTokenId,
  valuesPending,
  canEditCostBasis,
  savingCostBasisTokenId,
  redeemSelectMode,
  redeemSelected,
  redeemEligibleIds,
  onToggleRedeemToken,
  onSaveCostBasis,
  onSetPrice,
  getBadge,
  isTradeBlocked,
}: {
  rows: AssetRow[];
  metadataByTokenId: Map<number, RwaMetadata | null>;
  costBasisByTokenId: Map<number, number>;
  vaultLabelByTokenId?: Map<number, string>;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasisTokenId?: number | null;
  redeemSelectMode: boolean;
  redeemSelected?: Set<number>;
  redeemEligibleIds?: Set<number>;
  onToggleRedeemToken?: (tokenId: number, checked: boolean) => void;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  onSetPrice: (tokenId: number) => void;
  getBadge: (tokenId: number) => RedeemSurfaceBadge | null;
  isTradeBlocked: (tokenId: number) => boolean;
}) {
  return (
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
          <PortfolioStaticTh label="Card" sortHint />
          <PortfolioStaticTh label="Vault" sortHint />
          <PortfolioStaticTh label="Cost basis" align="right" sortHint />
          <PortfolioStaticTh label="Mkt Price" align="right" sortHint />
          <PortfolioStaticTh label="Profit" align="right" sortHint />
          <PortfolioStaticTh label="Return" align="right" sortHint />
          <PortfolioStaticTh label="Action" align="right" muted />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const meta = metadataByTokenId.get(row.tokenId) ?? null;
          const grade = formatPortfolioGradeLabel(meta);
          const gradeSub = formatPortfolioGradeSubtitle(meta);
          const cost = costBasisByTokenId.get(row.tokenId);
          const isListed =
            row.listPriceUsd != null && row.activeListingOrderHash != null;
          const badge = getBadge(row.tokenId);
          const tradeBlocked = isTradeBlocked(row.tokenId);
          const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
          const zebra = index % 2 === 1 ? " pf-table-row--zebra" : "";
          const dim =
            badge?.kind === "transit" || badge?.kind === "possession"
              ? " pf-holdings-row--dim"
              : "";
          const selectable = redeemEligibleIds?.has(row.tokenId) ?? false;
          const selected = redeemSelected?.has(row.tokenId) ?? false;
          const vault = vaultLabelByTokenId?.get(row.tokenId) ?? "PSA Vault";

          return (
            <tr key={row.tokenId} className={`pf-holdings-row${zebra}${dim}`}>
              <td data-label="Card">
                <div className="pf-table-card-cell pf-table-card-cell--holdings">
                  {redeemSelectMode ? (
                    <input
                      type="checkbox"
                      className="pf-redeem-chk"
                      checked={selected}
                      disabled={!selectable}
                      onChange={(e) =>
                        onToggleRedeemToken?.(row.tokenId, e.target.checked)
                      }
                      aria-label={`Select ${row.name} for redeem`}
                    />
                  ) : null}
                  <Link
                    href={`/marketplace/${encodeURIComponent(row.tokenId)}`}
                    className="pf-table-card-cell"
                  >
                    <div className="pf-table-thumb">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt="" />
                      ) : null}
                    </div>
                    <div className="pf-table-card-copy">
                      <span className="pf-table-card-name" title={row.name}>
                        {row.name}
                      </span>
                      {gradeSub ? (
                        <span className="pf-table-card-sub tkl-mono">{gradeSub}</span>
                      ) : grade ? (
                        <span className="pf-table-card-sub tkl-mono">{grade}</span>
                      ) : null}
                    </div>
                  </Link>
                </div>
              </td>
              <td data-label="Vault">
                <span className="pf-vault-chip">{vault}</span>
              </td>
              <td data-label="Cost basis" className="pf-col-num-cell">
                {canEditCostBasis && onSaveCostBasis && !redeemSelectMode && !badge ? (
                  <PortfolioCostBasisInlineEdit
                    layout="desktop"
                    assetName={row.name}
                    valueUsd={cost}
                    editable
                    saving={savingCostBasisTokenId === row.tokenId}
                    onSave={(usd) => onSaveCostBasis(row.tokenId, usd)}
                  />
                ) : (
                  <span className="tkl-mono pf-table-cost">
                    {formatPortfolioUsd(cost)}
                  </span>
                )}
              </td>
              <td data-label="Mkt Price" className="pf-col-num-cell">
                <span className="tkl-mono pf-table-mkt">
                  {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
                </span>
              </td>
              <td data-label="Profit" className="pf-col-num-cell">
                <span
                  className={`tkl-mono pf-table-pl${
                    pnl
                      ? pnl.positive
                        ? " pf-table-pl--pos"
                        : " pf-table-pl--neg"
                      : ""
                  }`}
                >
                  {pnl?.profit ?? "—"}
                </span>
              </td>
              <td data-label="Return" className="pf-col-return-cell">
                <span
                  className={`tkl-mono pf-table-return${
                    pnl
                      ? pnl.positive
                        ? " pf-table-pl--pos"
                        : " pf-table-pl--neg"
                      : ""
                  }`}
                >
                  {pnl?.returnPct ?? "—"}
                </span>
              </td>
              <td data-label="Action" className="pf-col-action-cell">
                {!redeemSelectMode ? (
                  <PortfolioHoldingsRowActions
                    isListed={isListed}
                    disabled={tradeBlocked}
                    disabledTitle={
                      tradeBlocked
                        ? "Redemption in progress — listing unavailable"
                        : undefined
                    }
                    redeemStatus={badge}
                    onSetPrice={() => onSetPrice(row.tokenId)}
                  />
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </TkTable>
  );
}
