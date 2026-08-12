"use client";

import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";

export function PortfolioHideConfirmModal({
  open,
  tokenId,
  assetName,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  tokenId: number;
  assetName: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const title = assetName.trim() || `RWA #${tokenId}`;

  return (
    <TkDialog
      open={open}
      onClose={onClose}
      title="Hide from portfolio?"
      description={`${title} stays in your wallet and can be restored from Hidden.`}
      footer={
        <div className="flex w-full flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
          <TkButton
            variant="primary"
            className="w-full sm:flex-1"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "Hiding…" : "Hide"}
          </TkButton>
          <TkButton
            variant="neutral"
            className="w-full sm:flex-1"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </TkButton>
        </div>
      }
    />
  );
}
