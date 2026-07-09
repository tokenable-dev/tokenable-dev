"use client";

import { TkButton } from "@/components/ds";

/** List / Sell / Cancel — Portfolio.html (`tk-btn--subtle` + `tk-btn--primary`). */
export function PortfolioHoldingsRowActions({
  isListed,
  cancelling,
  onList,
  onCancel,
  onSellNow,
}: {
  isListed: boolean;
  cancelling: boolean;
  onList: () => void;
  onCancel: () => void;
  onSellNow: () => void;
}) {
  return (
    <div className="pf-table-actions">
      {isListed ? (
        <TkButton
          type="button"
          variant="subtle"
          size="sm"
          className="pf-table-btn pf-table-btn--listed-cancel"
          disabled={cancelling}
          onClick={onCancel}
        >
          {cancelling ? "…" : "Cancel"}
        </TkButton>
      ) : (
        <>
          <TkButton
            type="button"
            variant="subtle"
            size="sm"
            className="pf-table-btn"
            onClick={onList}
          >
            List
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="pf-table-btn"
            onClick={onSellNow}
          >
            Sell Now
          </TkButton>
        </>
      )}
    </div>
  );
}
