"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import { holdingsSaleKind } from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

/** Action column — 1:1 with sale status (Set price / Edit price / Track →). */
export function PortfolioHoldingsRowActions({
  isListed,
  fullWidth = false,
  disabled = false,
  disabledTitle,
  redeemStatus = null,
  onSetPrice,
}: {
  isListed: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  redeemStatus?: RedeemSurfaceBadge | null;
  onSetPrice: () => void;
}) {
  const kind = holdingsSaleKind(isListed, redeemStatus);
  const wrap = `pf-table-actions${fullWidth ? " pf-table-actions--full" : ""}`;

  if (kind === "redeeming") {
    const href = redeemStatus?.statusHref;
    if (!href) {
      return <div className={wrap} />;
    }
    return (
      <div className={`${wrap} pf-table-actions--status`}>
        <Link href={href} className="pf-table-actions__status-link tkl-mono">
          Track →
        </Link>
      </div>
    );
  }

  return (
    <div className={`${wrap}${disabled ? " pf-table-actions--dim" : ""}`}>
      <TkButton
        type="button"
        variant="ghost"
        size="sm"
        className={`pf-table-btn${fullWidth ? " pf-table-btn--full" : ""}`}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        onClick={onSetPrice}
      >
        {kind === "listed" ? "Edit price" : "Set price"}
      </TkButton>
    </div>
  );
}
