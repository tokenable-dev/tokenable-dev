"use client";

import type { MouseEvent } from "react";
import { TkButton } from "@/components/ds";

function stopCardNavigation(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Listed / unlisted CTAs on portfolio asset cards (inside clickable card). */
export function PortfolioAssetCardCta({
  isListed,
  busy,
  onChange,
  onCancel,
  onSellNow,
}: {
  isListed: boolean;
  busy: boolean;
  onChange: () => void;
  onCancel: () => void;
  onSellNow: () => void;
}) {
  return (
    <div
      className="flex w-full min-w-0 gap-2"
      onClick={stopCardNavigation}
    >
      {isListed ? (
        busy ? (
          <span className="w-full text-center text-[12px] font-semibold text-[var(--t2)]">
            Cancelling…
          </span>
        ) : (
          <>
            <TkButton
              variant="subtle"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                stopCardNavigation(e);
                onChange();
              }}
            >
              Change
            </TkButton>
            <TkButton
              variant="neutral"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                stopCardNavigation(e);
                onCancel();
              }}
            >
              Cancel
            </TkButton>
          </>
        )
      ) : (
        <TkButton
          variant="primary"
          size="sm"
          className="w-full"
          onClick={(e) => {
            stopCardNavigation(e);
            onSellNow();
          }}
        >
          Sell now
        </TkButton>
      )}
    </div>
  );
}
