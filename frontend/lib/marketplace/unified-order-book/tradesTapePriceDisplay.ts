/** Tape rows are newest-first; chronological prior trade is the next row. */
export type TradesTapePriceTone = "down" | "neutral";

export function tradesTapePriceCompareTone(
  priceUsdc: number,
  priorPriceUsdc: number | undefined,
): TradesTapePriceTone {
  if (
    priorPriceUsdc == null ||
    !Number.isFinite(priorPriceUsdc) ||
    !Number.isFinite(priceUsdc)
  ) {
    return "neutral";
  }
  if (priceUsdc < priorPriceUsdc) return "down";
  return "neutral";
}

export const TRADES_TAPE_PRICE_DOWN_CLASS = "text-rose-400";
export const TRADES_TAPE_PRICE_DEFAULT_CLASS = "text-mint/95";

export function tradesTapePriceClassName(tone: TradesTapePriceTone): string {
  return tone === "down"
    ? TRADES_TAPE_PRICE_DOWN_CLASS
    : TRADES_TAPE_PRICE_DEFAULT_CLASS;
}
