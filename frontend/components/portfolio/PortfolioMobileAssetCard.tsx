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

/** Mobile My Assets card — Portfolio.html `mobile-asset-card`. */
export function PortfolioMobileAssetCard({
  row,
  grade,
  cost,
  valuesPending,
  canEditCostBasis,
  savingCostBasis,
  isListed,
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
}: {
  row: AssetRow;
  grade: string | null;
  cost: number | undefined;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasis?: boolean;
  isListed: boolean;
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
            <TkTag tone="neutral" appearance="soft" className="pf-mobile-asset-card__grade">
              {grade}
            </TkTag>
          ) : null}
        </div>

        {redeemStatus?.kind === "possession" ? (
          <div className="pf-mobile-asset-card__possession tkl-mono">In your possession</div>
        ) : null}

        {redeemStatus && redeemStatus.kind !== "possession" ? (
          <div className="pf-mobile-asset-card__status">
            <span className={`pf-redeem-badge pf-redeem-badge--${redeemStatus.tone}`}>
              {redeemStatus.label}
            </span>
            {redeemStatus.kind === "transit" ? (
              <div className="pf-mobile-asset-card__note">
                This card is on its way — it can&apos;t be listed.
              </div>
            ) : redeemStatus.kind === "preparing" ||
              redeemStatus.kind === "custody_pending" ? (
              <div className="pf-mobile-asset-card__note pf-mobile-asset-card__note--azure">
                {redeemStatus.kind === "custody_pending"
                  ? "Paid — finish transferring NFTs into custody."
                  : "Paid — your cards are being prepared."}
              </div>
            ) : null}
          </div>
        ) : null}

        {redeemStatus?.kind !== "transit" && redeemStatus?.kind !== "possession" ? (
          <>
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
                  <span className="pf-mobile-asset-card__val tkl-mono">
                    {formatPortfolioUsd(cost)}
                  </span>
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
          </>
        ) : null}

        {!selectMode && redeemStatus?.kind !== "possession" ? (
          <div
            className="pf-mobile-asset-card__actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PortfolioHoldingsRowActions
              isListed={isListed}
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
