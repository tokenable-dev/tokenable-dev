"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

/** Set price / Edit price — or redeem status CTAs (right-side Action only). */
export function PortfolioHoldingsRowActions({
  isListed,
  fullWidth = false,
  disabled = false,
  disabledTitle,
  redeemStatus = null,
  onSetPrice,
}: {
  isListed: boolean;
  /** Mobile cards use full-width ghost CTA (height 44). */
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
