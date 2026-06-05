"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  cancelOrder,
  getMarketplaceCollectionDetail,
  getOrderByHash,
  rq,
  type Order,
} from "@/lib/core";
import { invalidateAfterCriteriaBid } from "@/lib/core/invalidation";

export function usePortfolioBidActions(input: {
  address: string | undefined;
  queryClient: QueryClient;
  refetchActiveOrders: () => Promise<unknown>;
  refetchPortfolioBids: () => Promise<unknown>;
}) {
  const { address, queryClient, refetchActiveOrders, refetchPortfolioBids } = input;

  const [cancellingHash, setCancellingHash] = useState<string | null>(null);
  const [openingChangeHash, setOpeningChangeHash] = useState<string | null>(null);
  const [changeModal, setChangeModal] = useState<{
    bid: Order;
    collectionKey: string;
    activeAsks: Order[];
  } | null>(null);

  const refreshBidData = useCallback(
    async (collectionKey?: string) => {
      await Promise.all([refetchActiveOrders(), refetchPortfolioBids()]);
      if (collectionKey) {
        await invalidateAfterCriteriaBid(queryClient, collectionKey);
      }
      if (address) {
        await queryClient.invalidateQueries({ queryKey: rq.portfolioBids(address) });
      }
    },
    [address, queryClient, refetchActiveOrders, refetchPortfolioBids],
  );

  const handleCancel = useCallback(
    async (orderHash: string, collectionKey: string) => {
      if (!address) return;
      setCancellingHash(orderHash);
      try {
        await cancelOrder(orderHash, address);
        await refreshBidData(collectionKey);
      } finally {
        setCancellingHash(null);
      }
    },
    [address, refreshBidData],
  );

  const openChangeBid = useCallback(
    async (orderHash: string, collectionKey: string) => {
      setOpeningChangeHash(orderHash);
      try {
        const [bid, detail] = await Promise.all([
          getOrderByHash(orderHash),
          getMarketplaceCollectionDetail(collectionKey),
        ]);
        setChangeModal({
          bid,
          collectionKey,
          activeAsks: detail.listings.filter((o) => o.status === "active"),
        });
      } finally {
        setOpeningChangeHash(null);
      }
    },
    [],
  );

  const closeChangeModal = useCallback(() => setChangeModal(null), []);

  const handleBidUpdated = useCallback(
    async (collectionKey: string) => {
      await refreshBidData(collectionKey);
      setChangeModal(null);
    },
    [refreshBidData],
  );

  return {
    cancellingHash,
    openingChangeHash,
    changeModal,
    openChangeBid,
    closeChangeModal,
    handleCancel,
    handleBidUpdated,
  };
}
