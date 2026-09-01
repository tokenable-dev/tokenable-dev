"use client";

import Link from "next/link";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
  portfolioPriceChangeArrow,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { TkTable } from "@/components/ds";
import { portfolioAssetHref } from "@/lib/portfolio/portfolioPaths";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioHoldingsSaleStatus } from "./PortfolioHoldingsSaleStatus";
import { PortfolioStaticTh } from "./PortfolioSortableTh";

/** Portfolio.html `#pf-tableview` — My Assets table layout. */
export function PortfolioHoldingsTableView({
  rows,
  headlineByTokenId,
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
          <PortfolioStaticTh label="Cost basis" align="right" sortHint />
          <PortfolioStaticTh label="Mkt Price" align="right" sortHint />
          <PortfolioStaticTh label="$ Chg." align="right" sortHint />
          <PortfolioStaticTh label="% Chg." align="right" sortHint />
          <PortfolioStaticTh label="Status" muted />
          <PortfolioStaticTh label="Action" align="right" muted />
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
          const line2 = headline?.line2?.trim() || "";

          return (
            <tr key={row.tokenId} className={`pf-holdings-row${zebra}${dim}`}>
              <td data-label="Card">
                <div className="pf-table-card-cell pf-table-card-cell--holdings">
                  <Link
                    href={portfolioAssetHref(assetHrefBase, row.tokenId)}
                    className="pf-table-card-cell"
                  >
                    <div className="pf-table-thumb">
                      {row.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : null}
                    </div>
                    <div className="pf-table-card-copy">
                      {headline ? (
                        <AssetDetailHeadlineTitle
                          as="span"
                          parts={headline.parts}
                          grade={headline.grade}
                          className="pf-table-card-name block min-w-0 text-[inherit] font-[inherit] leading-[inherit] text-inherit [--cd-line1-lh:1.35]"
                        />
                      ) : (
                        <span className="pf-table-card-name" title={titleLabel}>
                          {titleLabel}
                        </span>
                      )}
                      {line2 ? (
                        <span className="pf-table-card-sub pf-table-card-sub--hover">
                          {line2}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </div>
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
                  {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
                  {pnl ? (
                    <span
                      className={`pf-mkt-dir${
                        pnl.positive ? " pf-table-pl--pos" : " pf-table-pl--neg"
                      }`}
                      aria-hidden
                    >
                      {portfolioPriceChangeArrow(pnl.positive)}
                    </span>
                  ) : null}
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
                  listPriceUsd={row.listPriceUsd}
                  redeemStatus={badge}
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
