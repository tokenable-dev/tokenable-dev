"use client";

import type { MouseEvent } from "react";
import { TkButton } from "@/components/ds";

/** Unlisted card CTA — primary DS button. */
export function PortfolioSellNowButton({ onClick }: { onClick: () => void }) {
  return (
    <TkButton
      variant="primary"
      size="sm"
      className="w-full"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      Sell now
    </TkButton>
  );
}
