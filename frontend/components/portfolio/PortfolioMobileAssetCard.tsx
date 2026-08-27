"use client";

import Link from "next/link";
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
  href,
  grade,
  cost,
  valuesPending,
  canEditCostBasis,
  savingCostBasis,
  isListed,
  redeemStatus = null,
  actionsDisabled = false,
  actionsDisabledTitle,
  onSaveCostBasis,
  onSetPrice,
}: {
  row: AssetRow;
  href?: string;
  grade: string | null;
  cost: number | undefined;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasis?: boolean;
  isListed: boolean;
  redeemStatus?: RedeemSurfaceBadge | null;
  actionsDisabled?: boolean;
  actionsDisabledTitle?: string;
  onSaveCostBasis?: (costBasisUsd: number) => void | Promise<void>;
  onSetPrice: () => void;
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const plClass = pnl ? (pnl.positive ? "pf-table-pl--pos" : "pf-table-pl--neg") : "";
  const costEditable = canEditCostBasis && !redeemStatus;
  const dimClass =
    redeemStatus?.kind === "transit"
      ? " pf-mobile-asset-card--transit"
      : redeemStatus?.kind === "possession"
        ? " pf-mobile-asset-card--possession"
        : "";

  return (
    <div className={`pf-mobile-asset-card${dimClass}`} role="listitem">
      <div className="pf-mobile-asset-card__img">
        {href ? (
          <Link href={href} aria-label={row.name}>
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" />
            ) : null}
          </Link>
        ) : row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" />
        ) : null}
      </div>
      <div className="pf-mobile-asset-card__info">
        <div className="pf-mobile-asset-card__head">
          <div className="pf-mobile-asset-card__title" title={row.name}>
            {href ? <Link href={href}>{row.name}</Link> : row.name}
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
            <div className="pf-mobile-asset-card__row">
              <span className="pf-mobile-asset-card__label">Mkt Price</span>
              <span className="pf-mobile-asset-card__val tkl-mono">
                {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
              </span>
            </div>
            <div className="pf-mobile-asset-card__row">
              <span className="pf-mobile-asset-card__label">$ Chg.</span>
              <span className={`pf-mobile-asset-card__val tkl-mono pf-table-pl ${plClass}`}>
                {pnl ? pnl.profit : "—"}
              </span>
            </div>
            <div className="pf-mobile-asset-card__row">
              <span className="pf-mobile-asset-card__label">% Chg.</span>
              <span
                className={`pf-mobile-asset-card__val pf-mobile-asset-card__return tkl-mono pf-table-pl ${plClass}`}
              >
                {pnl ? pnl.returnPct : "—"}
              </span>
            </div>
          </>
        ) : null}

        {redeemStatus?.kind !== "possession" ? (
          <div className="pf-mobile-asset-card__actions">
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
