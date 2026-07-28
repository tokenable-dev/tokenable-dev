"use client";

import { TkButton } from "@/components/ds";
import { TkDialog } from "@/components/ds/Dialog";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";

/** Cancel Listing? — portfolio-modals.js `pfCancelListingModal` (design system-2). */
export function PortfolioCancelListingConfirmModal({
  open,
  assetTitle,
  gradeLabel,
  listPriceUsd,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  assetTitle: string;
  gradeLabel?: string | null;
  listPriceUsd?: number | null;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const title = assetTitle.trim() || "This listing";
  const price = formatPortfolioUsd(listPriceUsd);
  const grade = gradeLabel?.trim();
  const detail = [title, grade, price !== "—" ? `Listed ${price}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <TkDialog
      open={open}
      onClose={pending ? () => undefined : onClose}
      title="Cancel Listing?"
      description={`Your listing will be removed from the market. ${detail}`}
      footer={
        <div className="flex flex-col gap-2 w-full">
          <TkButton
            variant="danger"
            size="sm"
            className="w-full justify-center"
            disabled={pending}
            onClick={() => void onConfirm()}
          >
            {pending ? "…" : "Cancel Listing"}
          </TkButton>
          <TkButton
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            disabled={pending}
            onClick={onClose}
          >
            Keep Listed
          </TkButton>
        </div>
      }
    />
  );
}
