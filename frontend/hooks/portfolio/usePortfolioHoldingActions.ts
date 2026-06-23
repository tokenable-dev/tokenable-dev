"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  cancelOrder,
  hidePortfolioHolding,
  rq,
  unhidePortfolioHolding,
  type OrderListItem,
} from "@/lib/core";

export function usePortfolioHoldingActions(input: {
  address: string | undefined;
  queryClient: QueryClient;
  refetchActiveOrders: () => Promise<unknown>;
}) {
  const { address, queryClient, refetchActiveOrders } = input;

  const [cancellingListingTokenId, setCancellingListingTokenId] = useState<number | null>(
    null,
  );
  const [hidingTokenId, setHidingTokenId] = useState<number | null>(null);
  const [unhidingTokenId, setUnhidingTokenId] = useState<number | null>(null);
  const [hideConfirm, setHideConfirm] = useState<{ tokenId: number; name: string } | null>(
    null,
  );

  const executeHideHolding = useCallback(
    async (tokenId: number) => {
      if (!address) return;
      setHidingTokenId(tokenId);
      const hiddenKey = rq.portfolioHidden(address);
      const prev = queryClient.getQueryData<number[]>(hiddenKey);
      queryClient.setQueryData<number[]>(hiddenKey, (old) => {
        const next = new Set(old ?? []);
        next.add(tokenId);
        return [...next];
      });
      try {
        await hidePortfolioHolding(address, tokenId);
        void queryClient.invalidateQueries({
          queryKey: rq.portfolioDailySnapshots(address),
        });
        setHideConfirm(null);
      } catch (err) {
        if (prev !== undefined) {
          queryClient.setQueryData(hiddenKey, prev);
        } else {
          void queryClient.invalidateQueries({ queryKey: hiddenKey });
        }
        window.alert(err instanceof Error ? err.message : "Failed to hide card");
      } finally {
        setHidingTokenId(null);
      }
    },
    [address, queryClient],
  );

  const unhideHolding = useCallback(
    async (tokenId: number) => {
      if (!address) return;
      setUnhidingTokenId(tokenId);
      const hiddenKey = rq.portfolioHidden(address);
      const prev = queryClient.getQueryData<number[]>(hiddenKey);
      queryClient.setQueryData<number[]>(hiddenKey, (old) =>
        (old ?? []).filter((id) => id !== tokenId),
      );
      try {
        await unhidePortfolioHolding(address, tokenId);
        void queryClient.invalidateQueries({
          queryKey: rq.portfolioDailySnapshots(address),
        });
      } catch (err) {
        if (prev !== undefined) {
          queryClient.setQueryData(hiddenKey, prev);
        } else {
          void queryClient.invalidateQueries({ queryKey: hiddenKey });
        }
        window.alert(err instanceof Error ? err.message : "Failed to unhide card");
      } finally {
        setUnhidingTokenId(null);
      }
    },
    [address, queryClient],
  );

  const cancelListing = useCallback(
    async (tokenId: number, orderHash: string) => {
      if (!address) return;
      setCancellingListingTokenId(tokenId);
      const qk = rq.ordersActive();
      const prev = queryClient.getQueryData<OrderListItem[]>(qk);
      queryClient.setQueryData<OrderListItem[]>(qk, (old) =>
        (old ?? []).filter((o) => o.orderHash !== orderHash),
      );
      try {
        await cancelOrder(orderHash, address);
        await refetchActiveOrders();
      } catch (err) {
        if (prev !== undefined) {
          queryClient.setQueryData(qk, prev);
        } else {
          void queryClient.invalidateQueries({ queryKey: qk });
        }
        window.alert(
          err instanceof Error ? err.message : "Failed to cancel listing",
        );
      } finally {
        setCancellingListingTokenId(null);
      }
    },
    [address, queryClient, refetchActiveOrders],
  );

  const requestHide = useCallback((tokenId: number, name: string, hasListing: boolean) => {
    if (!address) return;
    if (hasListing) {
      window.alert("Cancel listing first, then hide.");
      return;
    }
    setHideConfirm({ tokenId, name });
  }, [address]);

  return {
    cancellingListingTokenId,
    hidingTokenId,
    unhidingTokenId,
    hideConfirm,
    setHideConfirm,
    executeHideHolding,
    unhideHolding,
    cancelListing,
    requestHide,
  };
}
