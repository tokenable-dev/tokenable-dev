import type { Order } from "@/lib/core";

/** Card-level offer — USDC offer + ERC721 consideration for a specific tokenId. */
export function isTokenBidOrder(order: Pick<Order, "side" | "parameters">): boolean {
  if (order.side !== "bid") return false;
  const offer = order.parameters?.offer?.[0];
  const cons = order.parameters?.consideration?.[0];
  return Number(offer?.itemType) === 1 && Number(cons?.itemType) === 2;
}
