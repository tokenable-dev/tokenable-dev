"use client";

import type { MouseEvent } from "react";
import { TkButton } from "@/components/ds";

/** Listed card actions — Change / Cancel listing. */
export function PortfolioListingManageButton({
  busy,
  onChange,
  onCancel,
}: {
  busy: boolean;
  onChange: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="flex w-full min-w-0 gap-2"
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {busy ? (
        <span className="w-full text-center text-[12px] font-semibold text-[var(--t2)]">
          Cancelling…
        </span>
      ) : (
        <>
          <TkButton
            variant="subtle"
            size="sm"
            className="flex-1"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onChange();
            }}
          >
            Change
          </TkButton>
          <TkButton
            variant="neutral"
            size="sm"
            className="flex-1"
            onClick={(e: MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </TkButton>
        </>
      )}
    </div>
  );
}
