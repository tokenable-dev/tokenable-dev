import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";

export type CollectionTradeTab = "buy" | "sell";

export function formatMarketTradePriceLabel(
  bookSelection: BookRowSelection | null,
  presetPriceFromBook: string | null,
): string {
  if (bookSelection != null && Number.isFinite(bookSelection.price) && bookSelection.price > 0) {
    return `${bookSelection.price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}$`;
  }
  const p = presetPriceFromBook?.trim();
  if (p) return p.endsWith("$") ? p : `${p}$`;
  return "—";
}
