"use client";

import Link from "next/link";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { portfolioAssetHref } from "@/lib/portfolio/portfolioPaths";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioHoldingsSaleStatus } from "./PortfolioHoldingsSaleStatus";
import { PortfolioStaticTh } from "./PortfolioSortableTh";

export type HoldingsVaultChip = { text: string; tone: "psa" | "partner" };

/** Portfolio.html `#pf-tableview` — My Assets table layout. */
export function PortfolioHoldingsTableView({
  rows,
  headlineByTokenId,
  vaultByTokenId,
  costBasisByTokenId,
  valuesPending,
  canEditCostBasis,
  savingCostBasisTokenId,
  onSaveCostBasis,
  onSetPrice,
  getBadge,
  isTradeBlocked,
  assetHrefBase,
}: {
  rows: AssetRow[];
  headlineByTokenId: Map<number, PortfolioHoldingsHeadline>;
  vaultByTokenId?: Map<number, HoldingsVaultChip>;
  costBasisByTokenId: Map<number, number>;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasisTokenId?: number | null;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  onSetPrice: (tokenId: number) => void;
  getBadge: (tokenId: number) => RedeemSurfaceBadge | null;
  isTradeBlocked: (tokenId: number) => boolean;
  assetHrefBase: string;
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
        <col className="pf-col-status" />
        <col className="pf-col-action" />
      </colgroup>
      <thead>
        <tr>
          <PortfolioStaticTh label="Card" sortHint />
          <PortfolioStaticTh label="Vault" sortHint />
          <PortfolioStaticTh label="Cost basis" sortHint />
          <PortfolioStaticTh label="Mkt Price" sortHint />
          <PortfolioStaticTh label="$ Chg." sortHint />
          <PortfolioStaticTh label="% Chg." sortHint />
          <PortfolioStaticTh label="Status" muted />
          <PortfolioStaticTh label="Action" align="center" muted />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
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
          const headline = headlineByTokenId.get(row.tokenId) ?? null;
          const titleLabel = headline?.line1 ?? row.name;
          const vault = vaultByTokenId?.get(row.tokenId) ?? null;

          return (
            <tr key={row.tokenId} className={`asset-row pf-holdings-row${zebra}${dim}`}>
              <td data-label="Card">
                <Link
                  href={portfolioAssetHref(assetHrefBase, row.tokenId)}
                  className="pf-table-card-cell pf-table-card-cell--holdings"
                >
                  <div className="pf-table-thumb">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.imageUrl} alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </div>
                  <span
                    className={`pf-table-card-name ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}
                    title={headline?.hover ?? titleLabel}
                  >
                    {titleLabel}
                  </span>
                </Link>
              </td>
              <td data-label="Vault" className="pf-col-grade-cell">
                {vault ? (
                  <span
                    className={`pf-vault-chip${
                      vault.tone === "partner" ? " pf-vault-chip--partner" : ""
                    }`}
                  >
                    {vault.text}
                  </span>
                ) : (
                  <span className="pf-table-muted">—</span>
                )}
              </td>
              <td data-label="Cost basis" className="pf-col-num-cell">
                {canEditCostBasis && onSaveCostBasis && !badge ? (
                  <PortfolioCostBasisInlineEdit
                    layout="desktop"
                    assetName={titleLabel}
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
                  {valuesPending && row.currentPrice == null
                    ? "…"
                    : formatUsdCompact(row.currentPrice)}
                </span>
              </td>
              <td data-label="$ Chg." className="pf-col-num-cell">
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
              <td data-label="% Chg." className="pf-col-return-cell">
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
              <td data-label="Status">
                <PortfolioHoldingsSaleStatus
                  isListed={isListed}
                  redeemStatus={badge}
                  listPriceUsd={row.listPriceUsd}
                />
              </td>
              <td data-label="Action" className="pf-col-action-cell">
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </TkTable>
  );
}
