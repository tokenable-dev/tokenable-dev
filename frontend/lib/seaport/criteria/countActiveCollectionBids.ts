import type { OrderListItem } from "@/lib/core";

export function countActiveCollectionBidsForCollection(
  orders: OrderListItem[] | undefined,
  collectionKey: string,
): number {
  const key = String(collectionKey ?? "").trim().toLowerCase();
  if (!key) return 0;
  return (orders ?? []).filter(
    (o) =>
      o.side === "bid" &&
      o.status === "active" &&
      String(o.collectionKey ?? "").trim().toLowerCase() === key,
  ).length;
}
