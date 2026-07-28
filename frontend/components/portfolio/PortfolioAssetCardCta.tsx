"use client";

import type { MouseEvent } from "react";
import { TkButton } from "@/components/ds";

function stopCardNavigation(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Legacy card CTA — prefer `PortfolioHoldingsRowActions` (Set price / Edit price). */
export function PortfolioAssetCardCta({
  isListed,
  onSetPrice,
}: {
  isListed: boolean;
  busy?: boolean;
  onSetPrice: () => void;
  /** @deprecated */
  onChange?: () => void;
  /** @deprecated */
  onCancel?: () => void;
  /** @deprecated */
  onSellNow?: () => void;
}) {
  return (
    <div className="flex w-full min-w-0 gap-2" onClick={stopCardNavigation}>
      <TkButton
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={(e) => {
          stopCardNavigation(e);
          onSetPrice();
        }}
      >
        {isListed ? "Edit price" : "Set price"}
      </TkButton>
    </div>
  );
}
