"use client";

import { TkTag } from "@/components/ds";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";

/** Mobile My Assets card — Portfolio.html `mobile-asset-card`. */
export function PortfolioMobileAssetCard({
  row,
  grade,
  cost,
  valuesPending,
  canEditCostBasis,
  savingCostBasis,
  isListed,
  highestBidUsd,
  onOpen,
  onSaveCostBasis,
  onSetPrice,
}: {
  row: AssetRow;
  grade: string | null;
  cost: number | undefined;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasis?: boolean;
  isListed: boolean;
  highestBidUsd?: number | null;
  onOpen: () => void;
  onSaveCostBasis?: (costBasisUsd: number) => void | Promise<void>;
  onSetPrice: () => void;
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const plClass = pnl ? (pnl.positive ? "pf-table-pl--pos" : "pf-table-pl--neg") : "";

  return (
    <div
      className="pf-mobile-asset-card"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="pf-mobile-asset-card__img">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" />
        ) : null}
      </div>
      <div className="pf-mobile-asset-card__info">
        <div className="pf-mobile-asset-card__head">
          <div className="pf-mobile-asset-card__title" title={row.name}>
            {row.name}
          </div>
          {grade ? (
            <TkTag tone="neutral" appearance="soft" className="pf-mobile-asset-card__grade">
              {grade}
            </TkTag>
          ) : null}
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {canEditCostBasis && onSaveCostBasis ? (
            <PortfolioCostBasisInlineEdit
              layout="mobile"
              assetName={row.name}
              valueUsd={cost}
              editable
              saving={savingCostBasis}
              onSave={onSaveCostBasis}
            />
          ) : (
            <div className="pf-mobile-asset-card__row">
              <span className="pf-mobile-asset-card__label">Cost</span>
              <span className="pf-mobile-asset-card__val tkl-mono">{formatPortfolioUsd(cost)}</span>
            </div>
          )}
        </div>
        <div className="pf-mobile-asset-card__row">
          <span className="pf-mobile-asset-card__label">Mkt Price</span>
          <span className="pf-mobile-asset-card__val tkl-mono">
            {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
          </span>
        </div>
        <div className="pf-mobile-asset-card__row">
          <span className="pf-mobile-asset-card__label">Profit</span>
          <span className={`pf-mobile-asset-card__val tkl-mono pf-table-pl ${plClass}`}>
            {pnl ? pnl.profit : "—"}
          </span>
        </div>
        <div className="pf-mobile-asset-card__row">
          <span className="pf-mobile-asset-card__label">Return</span>
          <span
            className={`pf-mobile-asset-card__val pf-mobile-asset-card__return tkl-mono pf-table-pl ${plClass}`}
          >
            {pnl ? pnl.returnPct : "—"}
          </span>
        </div>

        <div
          className="pf-mobile-asset-card__actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <PortfolioHoldingsRowActions
            isListed={isListed}
            highestBidUsd={highestBidUsd}
            fullWidth
            onSetPrice={onSetPrice}
          />
        </div>
      </div>
    </div>
  );
}
