"use client";

import { memo } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
  portfolioPriceChangeArrow,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import { PortfolioHoldingsSaleStatus } from "./PortfolioHoldingsSaleStatus";

/** Mobile My Assets card — Portfolio.html `mobile-asset-card`. */
export const PortfolioMobileAssetCard = memo(function PortfolioMobileAssetCard({
  row,
  headline,
  href,
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
  selectMode = false,
  selected = false,
  onToggleSelect,
  onActivate,
}: {
  row: AssetRow;
  headline: PortfolioHoldingsHeadline | null;
  href?: string;
  cost: number | undefined;
  valuesPending: boolean;
  canEditCostBasis: boolean;
  savingCostBasis?: boolean;
  isListed: boolean;
  redeemStatus?: RedeemSurfaceBadge | null;
  actionsDisabled?: boolean;
  actionsDisabledTitle?: string;
  onSaveCostBasis?: (tokenId: number, costBasisUsd: number) => void | Promise<void>;
  onSetPrice: (tokenId: number) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onActivate?: () => void;
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const plClass = pnl ? (pnl.positive ? "pf-table-pl--pos" : "pf-table-pl--neg") : "";
  const costEditable = canEditCostBasis && !redeemStatus;
  const titleHover = headline?.hover ?? row.name;
  const titleLabel = headline?.line1 ?? row.name;
  const dimClass =
    redeemStatus?.kind === "transit"
      ? " pf-mobile-asset-card--transit"
      : redeemStatus?.kind === "possession"
        ? " pf-mobile-asset-card--possession"
        : "";
  const selectClass = selectMode
    ? [
        isListed && selected ? " pf-mobile-asset-card--cl-on" : "",
        !isListed ? " pf-mobile-asset-card--cl-dim" : "",
        isListed ? " pf-mobile-asset-card--cl-pick" : "",
      ].join("")
    : "";
  const activateClass =
    onActivate && !selectMode ? " pf-mobile-asset-card--activate" : "";

  return (
    <div
      className={`pf-mobile-asset-card${dimClass}${selectClass}${activateClass}`}
      role="listitem"
      onClick={
        selectMode && isListed
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect?.();
            }
          : onActivate && !selectMode
            ? (e) => {
                e.preventDefault();
                onActivate();
              }
            : undefined
      }
    >
      <div className="pf-mobile-asset-card__img">
        {href && !(selectMode && isListed) ? (
          <Link href={href} aria-label={titleLabel}>
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" loading="lazy" decoding="async" />
            ) : null}
          </Link>
        ) : row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : null}
        {selectMode && isListed ? (
          <div className={`pf-selchk${selected ? " pf-selchk--on" : ""}`} aria-hidden>
            {selected ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="pf-mobile-asset-card__info">
        <div className="pf-mobile-asset-card__head">
          <div className="pf-mobile-asset-card__title" title={titleHover}>
            {headline ? (
              href && !(selectMode && isListed) ? (
                <Link href={href} className="pf-mobile-asset-card__title-link">
                  <span className={CARD_DISPLAY_LINE1_CLAMP_CLASS}>
                    {headline?.line1 ?? titleLabel}
                  </span>
                </Link>
              ) : (
                <span className={CARD_DISPLAY_LINE1_CLAMP_CLASS}>
                  {headline?.line1 ?? titleLabel}
                </span>
              )
            ) : href && !(selectMode && isListed) ? (
              <Link href={href}>{titleLabel}</Link>
            ) : (
              titleLabel
            )}
          </div>
          <PortfolioHoldingsSaleStatus
            isListed={isListed}
            redeemStatus={redeemStatus}
            listPriceUsd={row.listPriceUsd}
          />
        </div>

        {redeemStatus?.kind !== "transit" && redeemStatus?.kind !== "possession" ? (
          <>
            {costEditable && onSaveCostBasis ? (
              <PortfolioCostBasisInlineEdit
                layout="mobile"
                assetName={titleLabel}
                valueUsd={cost}
                editable
                saving={savingCostBasis}
                onSave={(usd) => onSaveCostBasis(row.tokenId, usd)}
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
              <span className="pf-mobile-asset-card__val pf-mobile-asset-card__val--mkt tkl-mono">
                <span>
                  {valuesPending && row.currentPrice == null
                    ? "…"
                    : formatUsdCompact(row.currentPrice)}
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
                {pnl ? (
                  <span className={`pf-mobile-asset-card__return pf-table-pl ${plClass}`}>
                    {pnl.returnPct}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="pf-mobile-asset-card__row">
              <span className="pf-mobile-asset-card__label">$ Chg.</span>
              <span className={`pf-mobile-asset-card__val tkl-mono pf-table-pl ${plClass}`}>
                {pnl ? pnl.profit : "—"}
              </span>
            </div>
          </>
        ) : null}

        {!selectMode && redeemStatus?.kind !== "possession" ? (
          <div
            className="pf-mobile-asset-card__actions"
            onClick={onActivate ? (e) => e.stopPropagation() : undefined}
          >
            <PortfolioHoldingsRowActions
              isListed={isListed}
              fullWidth
              disabled={actionsDisabled}
              disabledTitle={actionsDisabledTitle}
              redeemStatus={redeemStatus}
              onSetPrice={() => {
                trackEvent(isListed ? "edit_price_clicked" : "set_price_clicked", {
                  card_id: String(row.tokenId),
                  current_price: row.currentPrice ?? undefined,
                });
                onSetPrice(row.tokenId);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});
