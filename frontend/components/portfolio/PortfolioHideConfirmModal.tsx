"use client";

import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";

function HideIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12c2.4-4 6-6 9-6s6.6 2 9 6c-2.4 4-6 6-9 6s-6.6-2-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

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
        <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:gap-3">
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
    >
      <div className="mb-2 flex justify-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/6 text-[var(--azure)]">
          <HideIcon />
        </span>
      </div>
    </TkDialog>
  );
}
