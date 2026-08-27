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
import { PortfolioTrendSparkline } from "./PortfolioTrendSparkline";

type GalleryStatusSeg =
  | "notlisted"
  | "listed"
  | "shipping"
  | "verifying"
  | "possession";

const GALLERY_STATUS: Record<
  GalleryStatusSeg,
  { label: string; className: string }
> = {
  notlisted: { label: "Not listed", className: "pf-gbadge--notlisted" },
  listed: { label: "Listed", className: "pf-gbadge--listed" },
  shipping: { label: "Shipping out", className: "pf-gbadge--shipping" },
  verifying: { label: "Verifying", className: "pf-gbadge--verifying" },
  possession: { label: "In possession", className: "pf-gbadge--possession" },
};

function galleryStatusSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): GalleryStatusSeg {
  if (redeemStatus?.kind === "possession") return "possession";
  if (redeemStatus?.kind === "transit") return "shipping";
  if (
    redeemStatus?.kind === "preparing" ||
    redeemStatus?.kind === "custody_pending"
  ) {
    return "verifying";
  }
  return isListed ? "listed" : "notlisted";
}

/** My Assets gallery tile — Portfolio.html `pf-gtile`. */
export function PortfolioHoldingsGalleryTile({
  row,
  href,
  grade,
  cost,
  vaultLabel,
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
  vaultLabel: string;
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
  const hasVal = row.currentPrice != null && Number.isFinite(row.currentPrice);
  const seg = galleryStatusSeg(isListed, redeemStatus);
  const badge = GALLERY_STATUS[seg];
  const costEditable = canEditCostBasis && !redeemStatus;
  const retLabel = pnl
    ? `${pnl.positive ? "↗" : "↘"} ${pnl.returnPct.replace("+", "").replace("-", "")}`
    : null;

  const tileClass = [
    "pf-gtile",
    redeemStatus?.kind === "transit" ? "pf-gtile--transit" : null,
    redeemStatus?.kind === "possession" ? "pf-gtile--possession" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={tileClass}>
      <div className="pf-gtile__media">
        {href ? (
          <Link href={href} className="pf-gtile__media-link" aria-label={row.name}>
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ) : (
              <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
            )}
          </Link>
        ) : row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
        )}
        <div className="pf-gtile__badge-wrap">
          <span className={`pf-gbadge tkl-mono ${badge.className}`}>{badge.label}</span>
        </div>
      </div>

      <div className="pf-gtile__body">
        <div className="pf-gtile__title" title={row.name}>
          {href ? (
            <Link href={href} className="pf-gtile__title-link">
              {row.name}
            </Link>
          ) : (
            row.name
          )}
        </div>
        <div className="pf-gtile__meta">
          {grade ? (
            <TkTag tone="neutral" appearance="soft" className="pf-gtile__grade">
              {grade}
            </TkTag>
          ) : null}
          <span className="pf-gtile__vault tkl-mono">{vaultLabel}</span>
        </div>

        <div className="pf-gtile__price-row">
          <div className="pf-gtile__price-main">
            <div className="pf-gtile__mkt" title="Market price">
              {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
            </div>
            {/* Always reserve return-line height so tiles stay equal without cost/mkt. */}
            <div
              className={`pf-gtile__ret tkl-mono${
                hasVal && retLabel && pnl
                  ? pnl.positive
                    ? " pf-table-pl--pos"
                    : " pf-table-pl--neg"
                  : " pf-gtile__ret--empty"
              }`}
              title={hasVal && retLabel ? "Unrealized return" : undefined}
              aria-hidden={!retLabel}
            >
              {hasVal && retLabel ? retLabel : "\u00a0"}
            </div>
          </div>
          <span className="pf-gtile__spark" title="1-year market price">
            {hasVal ? (
              <PortfolioTrendSparkline
                values={row.sparkline1y}
                width={60}
                height={16}
              />
            ) : null}
          </span>
        </div>

        {/* Always mount cost slot so hover/touch height stays uniform. */}
        <div className="pf-cost-hover">
          {costEditable && onSaveCostBasis ? (
            <PortfolioCostBasisInlineEdit
              layout="gallery"
              assetName={row.name}
              valueUsd={cost}
              currentPriceUsd={row.currentPrice}
              editable
              saving={savingCostBasis}
              onSave={onSaveCostBasis}
            />
          ) : cost != null ? (
            <span className="pf-cost-hover-line tkl-mono">
              <span className="pf-cost-hover-line__cost">
                {formatPortfolioUsd(cost)}
              </span>
              {hasVal ? (
                <>
                  <span className="pf-cost-hover-line__arrow" aria-hidden>
                    →
                  </span>
                  <span className="pf-cost-hover-line__mkt">
                    {formatPortfolioUsd(row.currentPrice)}
                  </span>
                </>
              ) : null}
            </span>
          ) : (
            <span className="pf-cost-hover-line pf-cost-hover-line--empty tkl-mono" aria-hidden>
              &nbsp;
            </span>
          )}
        </div>

        <div className="pf-gtile__act">
          <PortfolioHoldingsRowActions
            isListed={isListed}
            fullWidth
            disabled={actionsDisabled}
            disabledTitle={actionsDisabledTitle}
            redeemStatus={redeemStatus}
            onSetPrice={onSetPrice}
          />
        </div>
      </div>
    </div>
  );
}
