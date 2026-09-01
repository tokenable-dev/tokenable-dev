"use client";

import { memo } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";
import {
  formatPortfolioProfitReturn,
  formatPortfolioUsd,
  portfolioPriceChangeArrow,
  type PortfolioHoldingsHeadline,
} from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisInlineEdit } from "./PortfolioCostBasisInlineEdit";
import { PortfolioHoldingsRowActions } from "./PortfolioHoldingsRowActions";
import {
  holdingsSaleKind,
  holdingsSaleStatusLabel,
} from "@/lib/portfolio/portfolioHoldingsSaleStatus";

type GalleryStatusSeg = "notlisted" | "listed" | "redeeming";

const GALLERY_STATUS: Record<GalleryStatusSeg, { className: string }> = {
  notlisted: { className: "pf-gbadge--notlisted" },
  listed: { className: "pf-gbadge--listed" },
  redeeming: { className: "pf-gbadge--redeeming" },
};

function galleryStatusSeg(
  isListed: boolean,
  redeemStatus: RedeemSurfaceBadge | null,
): GalleryStatusSeg {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  if (kind === "listed") return "listed";
  if (kind === "redeeming") return "redeeming";
  return "notlisted";
}

/** My Assets gallery tile — Portfolio.html `pf-gtile`. */
export const PortfolioHoldingsGalleryTile = memo(function PortfolioHoldingsGalleryTile({
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
}) {
  const pnl = formatPortfolioProfitReturn(cost, row.currentPrice);
  const hasVal = row.currentPrice != null && Number.isFinite(row.currentPrice);
  const seg = galleryStatusSeg(isListed, redeemStatus);
  const badge = GALLERY_STATUS[seg];
  const badgeLabel = holdingsSaleStatusLabel(
    holdingsSaleKind(isListed, redeemStatus),
    row.listPriceUsd,
  );
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
              <img src={row.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
            )}
          </Link>
        ) : row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span className="pf-gtile__media-empty tkl-mono">#{row.tokenId}</span>
        )}
        <div className="pf-gtile__badge-wrap">
          <span className={`pf-gbadge tkl-mono ${badge.className}`}>{badgeLabel}</span>
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

        <div className="pf-gtile__price-row">
          <div className="pf-gtile__price-main card__price-row">
            <span className="card__price pf-gtile__mkt tkl-mono" title="Market price">
              {valuesPending ? "…" : formatPortfolioUsd(row.currentPrice)}
              {hasVal && pnl ? (
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
              onSave={(usd) => void onSaveCostBasis(row.tokenId, usd)}
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
            listPriceUsd={row.listPriceUsd}
            listedAskLabel
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
      </div>
    </div>
  );
});
