import type { OrderListItem } from "@/lib/core";

/**
 * User sent this token on a fulfilled ask listing (incl. sell-into-bid match).
 * Used to classify portfolio fills for "history-like" UI (tx rows).
 */
export function isPortfolioSellFill(o: OrderListItem, wallet: string): boolean {
  const w = wallet.trim().toLowerCase();
  if (!w || o.status !== "fulfilled") return false;
  if (o.side !== "ask") return false;
  return (o.offerer?.trim().toLowerCase() ?? "") === w;
}

/** Buyer side of a fulfilled trade (their bid, or ask they filled). */
export function isPortfolioBuyFill(o: OrderListItem, wallet: string): boolean {
  const w = wallet.trim().toLowerCase();
  if (!w || o.status !== "fulfilled") return false;
  if (o.side === "bid") {
    return (o.offerer?.trim().toLowerCase() ?? "") === w;
  }
  if (o.side === "ask") {
    return (o.filledByBuyer?.trim().toLowerCase() ?? "") === w;
  }
  return false;
}
