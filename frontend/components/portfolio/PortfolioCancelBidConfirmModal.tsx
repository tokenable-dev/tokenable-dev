"use client";

import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";
import type { PortfolioBidCancelConfirm } from "@/hooks/portfolio/usePortfolioBidActions";

export function PortfolioCancelBidConfirmModal({
  open,
  confirm,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  confirm: PortfolioBidCancelConfirm;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const isClearAll = confirm.mode === "clear_outbid";
  const isRemoveOutbid = confirm.mode === "remove_outbid";

  const title = isClearAll
    ? `Clear ${confirm.items.length} outbid offer${confirm.items.length === 1 ? "" : "s"}?`
    : isRemoveOutbid
      ? "Remove outbid?"
      : "Cancel bid?";

  const description = isClearAll
    ? "This cancels every offer that is no longer the highest bid on its collection. Sellers will no longer see them."
    : isRemoveOutbid
      ? `${confirm.collectionLabel.trim() || "Collection"} · ${confirm.priceLabel} USDC — cancels your offer so it leaves Active Bids and the order book.`
      : `${confirm.collectionLabel.trim() || "Collection bid"} · ${confirm.priceLabel} USDC`;

  const confirmLabel = isClearAll
    ? pending
      ? "Clearing…"
      : "Clear outbid"
    : isRemoveOutbid
      ? pending
        ? "Removing…"
        : "Remove"
      : pending
        ? "Cancelling…"
        : "Cancel bid";

  return (
    <TkDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
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
            {confirmLabel}
          </TkButton>
        </div>
      }
    />
  );
}
