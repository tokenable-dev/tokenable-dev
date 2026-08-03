"use client";

import { TkButton } from "@/components/ds";

/** Set price / Edit price — bid meta lives in the Set price drawer. */
export function PortfolioHoldingsRowActions({
  isListed,
  fullWidth = false,
  disabled = false,
  disabledTitle,
  statusLabel,
  onSetPrice,
}: {
  isListed: boolean;
  highestBidUsd?: number | null;
  /** Mobile cards use full-width ghost CTA (height 44). */
  fullWidth?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  /** When set, replaces the Set price CTA (e.g. Redeeming / On the way). */
  statusLabel?: string | null;
  onSetPrice: () => void;
}) {
  if (statusLabel) {
    return (
      <div
        className={`pf-table-actions pf-table-actions--status${fullWidth ? " pf-table-actions--full" : ""}`}
      >
        <span className="pf-table-actions__status tkl-mono">{statusLabel}</span>
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
