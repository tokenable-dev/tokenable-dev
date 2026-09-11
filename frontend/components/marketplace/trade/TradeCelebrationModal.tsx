"use client";

import type { TradeCelebrationKind } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  ActionCompleteModal,
  type ActionCompleteKind,
} from "@/components/marketplace/trade/ActionCompleteModal";

/**
 * Full-screen complete overlay after buy / matched sale.
 * Visual parity: Tokenable-with design system-4 `pfSaleResult`.
 */
export function TradeCelebrationModal({
  open,
  kind,
  priceUsdc,
  onClose,
}: {
  open: boolean;
  kind: TradeCelebrationKind;
  priceUsdc?: number | null;
  onClose: () => void;
}) {
  const acKind: ActionCompleteKind = kind === "sale" ? "sale" : "purchase";

  return (
    <ActionCompleteModal
      open={open}
      kind={acKind}
      priceUsdc={priceUsdc}
      onClose={onClose}
      primaryLabel="Done"
      secondaryLabel={acKind === "purchase" ? "View in Portfolio" : undefined}
      secondaryHref={acKind === "purchase" ? "/portfolio?tab=assets" : undefined}
      onSecondary={acKind === "purchase" ? onClose : undefined}
    />
  );
}
