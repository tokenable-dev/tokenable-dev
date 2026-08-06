"use client";

import { TkTag } from "@/components/ds";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";

/** Mobile My Assets card — Portfolio.html `mobile-asset-card` (status only in actions). */
export function PortfolioMobileAssetCard({
  row,
  grade,
  cost,
  valuesPending,
  canEditCostBasis,
  savingCostBasis,
  isListed,
  highestBidUsd,
  selectMode = false,
  selected = false,
  selectable = false,
  redeemStatus = null,
  actionsDisabled = false,
  actionsDisabledTitle,
  onToggleSelect,
  onOpen,
  onSaveCostBasis,
  onSetPrice,
  vaultLabel = "PSA Vault",
}: {
  row: AssetRow;
  grade: string | null;
  cost: number | undefined;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasis?: boolean;
  isListed: boolean;
  highestBidUsd?: number | null;
  selectMode?: boolean;
  selected?: boolean;
  selectable?: boolean;
  redeemStatus?: RedeemSurfaceBadge | null;
  actionsDisabled?: boolean;
  actionsDisabledTitle?: string;
  onToggleSelect?: (checked: boolean) => void;
  onOpen: () => void;
  onSaveCostBasis?: (costBasisUsd: number) => void | Promise<void>;
  onSetPrice: () => void;
  vaultLabel?: string;
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const plClass = pnl ? (pnl.positive ? "pf-table-pl--pos" : "pf-table-pl--neg") : "";
  const costEditable = canEditCostBasis && !selectMode && !redeemStatus;
  const dimClass =
    redeemStatus?.kind === "transit"
      ? " pf-mobile-asset-card--transit"
      : redeemStatus?.kind === "possession"
        ? " pf-mobile-asset-card--possession"
        : "";

  return (
    <div
      className={`pf-mobile-asset-card${selectMode && selected ? " pf-mobile-asset-card--selected" : ""}${selectMode ? " pf-mobile-asset-card--select" : ""}${dimClass}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (selectMode) {
          if (selectable) onToggleSelect?.(!selected);
          return;
        }
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectMode) {
            if (selectable) onToggleSelect?.(!selected);
            return;
          }
          onOpen();
        }
      }}
    >
      {selectMode ? (
        <div
          className="pf-redeem-chk-cell pf-redeem-chk-cell--mobile"
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
                  : redeemStatus
                    ? "Already in a redemption"
                    : "Not eligible for redeem"
            }
            onChange={(e) => onToggleSelect?.(e.target.checked)}
            aria-label={`Select ${row.name} for redeem`}
          />
        </div>
      ) : null}
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
            <span className="pf-grade-vault pf-grade-vault--mobile">
              <TkTag tone="neutral" appearance="soft" className="pf-mobile-asset-card__grade">
                {grade}
              </TkTag>
              <span className="pf-vault-chip">{vaultLabel}</span>
            </span>
          ) : null}
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {costEditable && onSaveCostBasis ? (
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

        {!selectMode ? (
          <div
            className="pf-mobile-asset-card__actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PortfolioHoldingsRowActions
              isListed={isListed}
              highestBidUsd={highestBidUsd}
              fullWidth
              disabled={actionsDisabled}
              disabledTitle={actionsDisabledTitle}
              redeemStatus={redeemStatus}
              onSetPrice={onSetPrice}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
