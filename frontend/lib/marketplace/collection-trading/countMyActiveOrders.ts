import type { Order } from "@/lib/core";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";

function isAskRow(o: Order): boolean {
  return String(o.side ?? "ask").toLowerCase() !== "bid";
}

export function countMyActiveOrders(
  asks: Order[],
  collectionBids: Order[],
  address?: string | null,
): number {
  const addr = address?.toLowerCase() ?? "";
  if (!addr) return 0;
  const listings = asks.filter(
    (o) => o.offerer.toLowerCase() === addr && o.status === "active" && isAskRow(o),
  );
  const bids = collectionBids.filter(
    (o) => o.offerer.toLowerCase() === addr && o.status === "active" && isCriteriaCollectionBid(o),
  );
  return listings.length + bids.length;
}
