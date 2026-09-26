"use client";

import { useMemo } from "react";
import type { OrderListItem } from "@/lib/core";

/** Active listing collection_key per tokenId for this wallet. */
export function usePortfolioListingCollectionKeys(
  allOrders: OrderListItem[],
  address: string | undefined,
): Map<number, string> {
  return useMemo(() => {
    const m = new Map<number, string>();
    const viewer = address?.trim().toLowerCase() ?? "";
    for (const o of allOrders) {
      if (o.status !== "active" || o.side !== "ask") continue;
      const offerer = o.offerer?.trim().toLowerCase() ?? "";
      if (!offerer || offerer !== viewer) continue;
      const ck = o.collectionKey?.trim();
      if (ck) m.set(Number(o.tokenId), ck.toLowerCase());
    }
    return m;
  }, [allOrders, address]);
}
