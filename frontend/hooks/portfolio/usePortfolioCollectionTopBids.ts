"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { formatUnits } from "viem";
import {
  getMarketplaceCollectionDetail,
  marketplaceRqPolicy,
  rq,
  type Order,
} from "@/lib/core";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";

export type PortfolioCollectionBidInfo = {
  highestBidUsd: number | null;
  bids: Order[];
};

function topBidUsd(bids: Order[]): number | null {
  const active = bids.filter(
    (b) => b.status === "active" && isCriteriaCollectionBid(b),
  );
  if (!active.length) return null;
  let best = BigInt(0);
  for (const b of active) {
    const amt = bidUsdcAmount(b);
    if (amt > best) best = amt;
  }
  if (best <= BigInt(0)) return null;
  try {
    return Number(formatUnits(best, 6));
  } catch {
    return null;
  }
}

/** Top collection bids for portfolio holdings — powers Highest bid / No bids yet meta. */
export function usePortfolioCollectionTopBids(
  collectionKeys: readonly string[],
  enabled: boolean,
) {
  const uniqueKeys = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of collectionKeys) {
      const key = raw?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }, [collectionKeys]);

  const queries = useQueries({
    queries: uniqueKeys.map((key) => ({
      queryKey: rq.collectionDetail(key),
      queryFn: () => getMarketplaceCollectionDetail(key),
      enabled: enabled && Boolean(key),
      staleTime: marketplaceRqPolicy.collectionDetailStaleMs,
    })),
  });

  const byCollectionKey = useMemo(() => {
    const map = new Map<string, PortfolioCollectionBidInfo>();
    uniqueKeys.forEach((key, i) => {
      const detail = queries[i]?.data;
      const bids = (detail?.collectionBids ?? []).filter((b) => b.status === "active");
      map.set(key, {
        highestBidUsd: topBidUsd(bids),
        bids,
      });
    });
    return map;
  }, [uniqueKeys, queries]);

  return { byCollectionKey };
}
