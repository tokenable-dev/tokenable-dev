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
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import { activeRqChainId } from "@/lib/chains";
import { normalizeDecimalTokenId } from "@/lib/marketplace";

export type PortfolioCollectionBidInfo = {
  highestBidUsd: number | null;
  bids: Order[];
};

function bidAmountUsd(b: Order): number | null {
  try {
    const n = Number(formatUnits(bidUsdcAmount(b), 6));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function topBidUsd(bids: Order[]): number | null {
  const active = bids.filter(
    (b) =>
      b.status === "active" &&
      (isCriteriaCollectionBid(b) || isTokenBidOrder(b)),
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

/** Best active bid for a holding: token offer on this tokenId, else top criteria bid. */
export function highestBidUsdForHolding(
  bids: Order[] | undefined,
  tokenId: string | number,
): number | null {
  if (!bids?.length) return null;
  const tokenIdNorm = normalizeDecimalTokenId(tokenId);
  let best: number | null = null;
  for (const b of bids) {
    if (b.status !== "active") continue;
    if (isTokenBidOrder(b)) {
      if (normalizeDecimalTokenId(b.tokenId) !== tokenIdNorm) continue;
    } else if (!isCriteriaCollectionBid(b)) {
      continue;
    }
    const usd = bidAmountUsd(b);
    if (usd == null) continue;
    if (best == null || usd > best) best = usd;
  }
  return best;
}

/** Top collection bids for portfolio holdings — powers Highest bid / No bids yet meta. */
export function usePortfolioCollectionTopBids(
  collectionKeys: readonly string[],
  enabled: boolean,
) {
  const chainId = activeRqChainId();
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
      queryKey: rq.collectionDetail(key, chainId),
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
