"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

function HoldingsBidMeta({
  isListed,
  highestBidUsd,
}: {
  isListed: boolean;
  highestBidUsd?: number | null;
}) {
  const hasBid = highestBidUsd != null && highestBidUsd > 0;
  if (!hasBid) {
    return (
      <div className="pf-holdings-bid-meta pf-holdings-bid-meta--empty">No bids yet</div>
    );
  }
  return (
    <div className="pf-holdings-bid-meta">
      {isListed ? (
        <>
          <span className="pf-holdings-bid-meta__listed">Listed</span>
          <span className="pf-holdings-bid-meta__dot">·</span>
        </>
      ) : null}
      Highest bid{" "}
      <span className="pf-holdings-bid-meta__bid">{formatPortfolioUsd(highestBidUsd)}</span>
    </div>
  );
}

/** Set price / Edit price — or redeem status CTAs (right-side Action only). */
export function PortfolioHoldingsRowActions({
  isListed,
  highestBidUsd,
  fullWidth = false,
  disabled = false,
  disabledTitle,
  redeemStatus = null,
  onSetPrice,
}: {
  isListed: boolean;
  highestBidUsd?: number | null;
  /** Mobile cards use full-width ghost CTA (height 44) + bid meta. */
  fullWidth?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  /** When set, replaces Set price with status on the Action column only. */
  redeemStatus?: RedeemSurfaceBadge | null;
  onSetPrice: () => void;
}) {
  if (redeemStatus) {
    if (redeemStatus.kind === "custody_pending" && redeemStatus.statusHref) {
      return (
        <div
          className={`pf-table-actions pf-table-actions--status pf-table-actions--preparing${fullWidth ? " pf-table-actions--full" : ""}`}
          title="Paid — finish transferring NFTs into custody"
        >
          {fullWidth ? null : (
            <span className={`pf-redeem-badge pf-redeem-badge--${redeemStatus.tone}`}>
              {redeemStatus.label}
            </span>
          )}
          <Link
            href={redeemStatus.statusHref}
            className="pf-table-actions__status-btn"
          >
            Finish transfer
          </Link>
        </div>
      );
    }

    if (redeemStatus.kind === "preparing" && redeemStatus.statusHref) {
      return (
        <div
          className={`pf-table-actions pf-table-actions--status pf-table-actions--preparing${fullWidth ? " pf-table-actions--full" : ""}`}
          title="Paid — being prepared to ship"
        >
          {fullWidth ? null : (
            <span className={`pf-redeem-badge pf-redeem-badge--${redeemStatus.tone}`}>
              {redeemStatus.label}
            </span>
          )}
          <Link
            href={redeemStatus.statusHref}
            className="pf-table-actions__status-btn"
          >
            View status
          </Link>
        </div>
      );
    }

    if (redeemStatus.kind === "transit" && redeemStatus.statusHref) {
      return (
        <div
          className={`pf-table-actions pf-table-actions--status${fullWidth ? " pf-table-actions--full" : ""}`}
          title="Redemption in progress — listing unavailable"
        >
          {fullWidth ? null : (
            <span className={`pf-redeem-badge pf-redeem-badge--${redeemStatus.tone}`}>
              {redeemStatus.label}
            </span>
          )}
          <Link
            href={redeemStatus.statusHref}
            className="pf-table-actions__status-link tkl-mono"
          >
            View status →
          </Link>
        </div>
      );
    }

    return (
      <div
        className={`pf-table-actions pf-table-actions--status${fullWidth ? " pf-table-actions--full" : ""}`}
      >
        <span className="pf-table-actions__status tkl-mono">{redeemStatus.label}</span>
      </div>
    );
  }

  return (
    <div
      className={`pf-table-actions pf-table-actions--set-price${fullWidth ? " pf-table-actions--full" : ""}${disabled ? " pf-table-actions--dim" : ""}`}
    >
      {fullWidth ? (
        <HoldingsBidMeta isListed={isListed} highestBidUsd={highestBidUsd} />
      ) : null}
      <TkButton
        type="button"
        variant="ghost"
        size="sm"
        className={`pf-table-btn${fullWidth ? " pf-table-btn--full" : ""}`}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={onSetPrice}
      >
        {isListed ? "Edit price" : "Set price"}
      </TkButton>
    </div>
  );
}
