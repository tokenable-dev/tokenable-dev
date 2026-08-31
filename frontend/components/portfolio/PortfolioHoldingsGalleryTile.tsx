"use client";

import Link from "next/link";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
  type PortfolioHoldingsHeadline,
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
  headline,
  href,
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
  headline: PortfolioHoldingsHeadline | null;
  href?: string;
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
  const retLabel = pnl?.returnPct ?? null;
  const titleHover = headline?.hover ?? row.name;
  const titleLabel = headline?.line1 ?? row.name;

  const tileClass = [
    "pf-gtile",
    redeemStatus?.kind === "transit" ? "pf-gtile--transit" : null,
    redeemStatus?.kind === "possession" ? "pf-gtile--possession" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const titleNode = headline ? (
    <AssetDetailHeadlineTitle
      as="span"
      parts={headline.parts}
      grade={headline.grade}
      className="block min-w-0 text-[inherit] font-[inherit] leading-[inherit] text-inherit [--cd-line1-lh:1.35]"
    />
  ) : (
    titleLabel
  );

  return (
    <div className={tileClass}>
      <div className="pf-gtile__media">
        {href ? (
          <Link href={href} className="pf-gtile__media-link" aria-label={titleLabel}>
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
        <div className="pf-gtile__title" title={titleHover}>
          {href ? (
            <Link href={href} className="pf-gtile__title-link">
              {titleNode}
            </Link>
          ) : (
            titleNode
          )}
        </div>
        <div className="pf-gtile__meta">
          <span className="pf-gtile__vault tkl-mono">{vaultLabel}</span>
        </div>

        <div className="pf-gtile__price-row">
          <div className="pf-gtile__price-main card__price-row">
            <span className="card__price pf-gtile__mkt" title="Market price">
              {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
            </span>
            <span
              className={`card__sub pf-gtile__ret tkl-mono${
                hasVal && retLabel && pnl
                  ? pnl.positive
                    ? " card__sub--up pf-table-pl--pos"
                    : " card__sub--down pf-table-pl--neg"
                  : " pf-gtile__ret--empty"
              }`}
              title={hasVal && retLabel ? "% change vs cost" : undefined}
              aria-hidden={!retLabel}
            >
              {hasVal && retLabel ? retLabel : "\u00a0"}
            </span>
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

        <div className="pf-cost-hover">
          {costEditable && onSaveCostBasis ? (
            <PortfolioCostBasisInlineEdit
              layout="gallery"
              assetName={titleLabel}
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
