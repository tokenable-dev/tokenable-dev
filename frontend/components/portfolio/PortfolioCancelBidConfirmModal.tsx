"use client";

import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";

export function PortfolioCancelBidConfirmModal({
  open,
  collectionLabel,
  priceLabel,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  collectionLabel: string;
  priceLabel: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const label = collectionLabel.trim() || "Collection bid";

  return (
    <TkDialog
      open={open}
      onClose={onClose}
      title="Cancel bid?"
      description={`${label} · ${priceLabel} USDC`}
      footer={
        <div className="flex gap-2">
          <TkButton
            variant="neutral"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={onClose}
          >
            Keep
          </TkButton>
          <TkButton
            variant="danger"
            size="sm"
            className="flex-1"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "…" : "Cancel bid"}
          </TkButton>
        </div>
      }
    />
  );
}
