"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCollectionBidsByOfferer,
  getMarketplaceCollectionDetailOrNull,
  rq,
  type OrderListItem,
} from "@/lib/core";
import { formatOrderUsdc6 } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import type {
  PortfolioBidCollectionMeta,
  PortfolioBidRow,
} from "@/lib/portfolio/portfolioBidTypes";
import { pickCollectionDetailDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { activeRqChainId } from "@/lib/chains";

const PORTFOLIO_USDC_DECIMALS = 1_000_000;

function orderToPortfolioBidRow(o: OrderListItem): PortfolioBidRow | null {
  const collectionKey = String(o.collectionKey ?? "").trim().toLowerCase();
  if (!collectionKey || o.side !== "bid") return null;
  const tokenId = String(o.tokenId ?? "").trim();
  // Legacy collection criteria bids used tokenId "0" — hide from Active Bids.
  if (!tokenId || tokenId === "0") return null;
  const priceUsdc = Number(o.price) / PORTFOLIO_USDC_DECIMALS;
  if (!Number.isFinite(priceUsdc)) return null;
  return {
    orderHash: o.orderHash,
    collectionKey,
    tokenId,
    priceUsdc,
    priceLabel: formatOrderUsdc6(o.price),
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function buildPortfolioBidRows(orders: OrderListItem[]): PortfolioBidRow[] {
  return orders
    .map(orderToPortfolioBidRow)
    .filter((r): r is PortfolioBidRow => r != null)
    .sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt).getTime();
      const tb = new Date(b.updatedAt ?? b.createdAt).getTime();
      if (tb !== ta) return tb - ta;
      if (b.priceUsdc !== a.priceUsdc) return b.priceUsdc - a.priceUsdc;
      return a.orderHash.localeCompare(b.orderHash);
    });
}

export function usePortfolioMyBids(address: string | undefined) {
  const chainId = activeRqChainId();
  const bidsQuery = useQuery({
    queryKey: rq.portfolioBids(address ?? "", chainId),
    queryFn: () => getCollectionBidsByOfferer(address!),
    enabled: Boolean(address?.trim()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const allBids = useMemo(
    () => buildPortfolioBidRows(bidsQuery.data ?? []),
    [bidsQuery.data],
  );

  const activeBids = useMemo(
    () => allBids.filter((b) => b.status === "active"),
    [allBids],
  );

  const collectionKeysSig = useMemo(
    () => [...new Set(activeBids.map((b) => b.collectionKey))].sort(),
    [activeBids],
  );

  const collectionMetaQuery = useQuery({
    queryKey: rq.portfolioBidCollections(collectionKeysSig),
    queryFn: async () => {
      const map = new Map<string, PortfolioBidCollectionMeta>();
      await Promise.all(
        collectionKeysSig.map(async (key) => {
          try {
            const detail = await getMarketplaceCollectionDetailOrNull(key);
            map.set(key, {
              displayLabel:
                detail?.collection?.displayLabel?.trim() ||
                key.replace(/^ch:/, "").slice(0, 48),
              imageUrl: detail
                ? pickCollectionDetailDisplayImageUrl(detail)
                : null,
            });
          } catch {
            map.set(key, {
              displayLabel: key.replace(/^ch:/, "").slice(0, 48),
              imageUrl: null,
            });
          }
        }),
      );
      return map;
    },
    enabled: collectionKeysSig.length > 0,
    staleTime: 60_000,
  });

  return {
    activeBids,
    collectionMetaByKey:
      collectionMetaQuery.data ?? new Map<string, PortfolioBidCollectionMeta>(),
    collectionMetaLoading:
      collectionMetaQuery.isLoading && collectionKeysSig.length > 0,
    loading: bidsQuery.isLoading,
    refetchBids: () => bidsQuery.refetch(),
  };
}
