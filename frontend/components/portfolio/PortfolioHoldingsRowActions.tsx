"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { holdingsSaleKind } from "@/lib/portfolio/portfolioHoldingsSaleStatus";
import type { RedeemSurfaceBadge } from "@/lib/portfolio/redeemDraft";

/** Action column — 1:1 with sale status (Set price / Edit price / Track →). */
export function PortfolioHoldingsRowActions({
  isListed,
  listPriceUsd = null,
  fullWidth = false,
  listedAskLabel = false,
  disabled = false,
  disabledTitle,
  redeemStatus = null,
  onSetPrice,
}: {
  isListed: boolean;
  listPriceUsd?: number | null;
  fullWidth?: boolean;
  /** Gallery / mobile: show `Listed · $n` (or `—`) above the CTA. */
  listedAskLabel?: boolean;
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

  const showAsk = listedAskLabel;
  const askText =
    isListed && listPriceUsd != null
      ? `Listed · ${formatPortfolioUsd(listPriceUsd)}`
      : "—";

  return (
    <div
      className={`${wrap}${showAsk ? " pf-table-actions--set-price" : ""}${disabled ? " pf-table-actions--dim" : ""}`}
    >
      {showAsk ? (
        <span
          className={`pf-table-ask tkl-mono${
            isListed && listPriceUsd != null ? "" : " pf-table-ask--empty"
          }`}
        >
          {askText}
        </span>
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
        {kind === "listed" ? "Edit price" : "Set price"}
      </TkButton>
    </div>
  );
}
