"use client";

import { TkButton } from "@/components/ds";
import { PortfolioHoldingsBidMeta } from "./PortfolioHoldingsBidMeta";

/** Set price / Edit price — Portfolio.html `tk-btn--ghost` + bid meta (design system-2). */
export function PortfolioHoldingsRowActions({
  isListed,
  highestBidUsd,
  fullWidth = false,
  onSetPrice,
}: {
  isListed: boolean;
  highestBidUsd?: number | null;
  /** Mobile cards use full-width ghost CTA (height 44). */
  fullWidth?: boolean;
  onSetPrice: () => void;
}) {
  return (
    <div className={`pf-table-actions pf-table-actions--set-price${fullWidth ? " pf-table-actions--full" : ""}`}>
      <PortfolioHoldingsBidMeta isListed={isListed} highestBidUsd={highestBidUsd} />
      <TkButton
        type="button"
        variant="ghost"
        size="sm"
        className={`pf-table-btn${fullWidth ? " pf-table-btn--full" : ""}`}
        onClick={onSetPrice}
      >
        {isListed ? "Edit price" : "Set price"}
      </TkButton>
    </div>
  );
}
