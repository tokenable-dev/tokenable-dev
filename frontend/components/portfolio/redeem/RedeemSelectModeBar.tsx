"use client";

import { TkButton } from "@/components/ds";

export function RedeemSelectModeBar({
  selectedCount,
  limitError,
  onCancel,
  onContinue,
}: {
  selectedCount: number;
  maxBatch: number;
  limitError: string | null;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="pf-redeem-batch-bar" role="region" aria-label="Redeem selection">
      <div className="pf-redeem-batch-bar__inner">
        <div className="pf-redeem-batch-bar__left">
          <span className="pf-redeem-batch-bar__count">
            {selectedCount} selected
          </span>
          {limitError ? (
            <span className="pf-redeem-batch-bar__err" role="alert">
              {limitError}
            </span>
          ) : null}
        </div>
        <div className="pf-redeem-batch-bar__actions">
          <TkButton
            type="button"
            variant="subtle"
            size="sm"
            className="pf-redeem-batch-bar__cancel"
            onClick={onCancel}
          >
            Cancel
          </TkButton>
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="pf-redeem-batch-bar__go"
            disabled={selectedCount === 0}
            onClick={onContinue}
          >
            Redeem {selectedCount} card{selectedCount === 1 ? "" : "s"}
          </TkButton>
        </div>
      </div>
    </div>
  );
}
