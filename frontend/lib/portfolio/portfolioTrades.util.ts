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

