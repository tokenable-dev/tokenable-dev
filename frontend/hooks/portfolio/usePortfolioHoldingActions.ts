"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  cancelOrder,
  hidePortfolioHolding,
  rq,
  unhidePortfolioHolding,
  type OrderListItem,
  type PortfolioHoldingBatchItem,
} from "@/lib/core";

export function usePortfolioHoldingActions(input: {
  address: string | undefined;
  tokenIds: readonly number[];
  queryClient: QueryClient;
  refetchActiveOrders: () => Promise<unknown>;
}) {
  const { address, tokenIds, queryClient, refetchActiveOrders } = input;

  const [cancellingListingTokenId, setCancellingListingTokenId] = useState<number | null>(
    null,
  );
  const [hidingTokenId, setHidingTokenId] = useState<number | null>(null);
  const [unhidingTokenId, setUnhidingTokenId] = useState<number | null>(null);
  const [hideConfirm, setHideConfirm] = useState<{ tokenId: number; name: string } | null>(
    null,
  );

  const holdingsKey =
    address != null ? rq.portfolioHoldings(address, tokenIds) : null;

  const patchHoldingsHidden = useCallback(
    (tokenId: number, hidden: boolean) => {
      if (!holdingsKey) return;
      queryClient.setQueryData<{ items: PortfolioHoldingBatchItem[] }>(
        holdingsKey,
        (old) => {
          if (!old) return old;
          const hasRow = old.items.some((item) => item.tokenId === tokenId);
          if (!hasRow && hidden) {
            return {
              items: [
                ...old.items,
                {
                  tokenId,
                  hidden: true,
                  costBasisUsd: null,
                  costBasisSource: null,
                  acquiredAt: null,
                },
              ],
            };
          }
          return {
            items: old.items.map((item) =>
              item.tokenId === tokenId ? { ...item, hidden } : item,
            ),
          };
        },
      );
    },
    [holdingsKey, queryClient],
  );

  const executeHideHolding = useCallback(
    async (tokenId: number) => {
      if (!address || !holdingsKey) return;
      setHidingTokenId(tokenId);
      const prev = queryClient.getQueryData<{ items: PortfolioHoldingBatchItem[] }>(
        holdingsKey,
      );
      patchHoldingsHidden(tokenId, true);
      try {
        await hidePortfolioHolding(address, tokenId);
        void queryClient.invalidateQueries({ queryKey: holdingsKey });
        void queryClient.invalidateQueries({
          queryKey: rq.portfolioDailySnapshots(address),
        });
        setHideConfirm(null);
      } catch (err) {
        if (prev !== undefined) {
          queryClient.setQueryData(holdingsKey, prev);
        } else {
          void queryClient.invalidateQueries({ queryKey: holdingsKey });
        }
        window.alert(err instanceof Error ? err.message : "Failed to hide card");
      } finally {
        setHidingTokenId(null);
      }
    },
    [address, holdingsKey, patchHoldingsHidden, queryClient],
  );

  const unhideHolding = useCallback(
    async (tokenId: number) => {
      if (!address || !holdingsKey) return;
      setUnhidingTokenId(tokenId);
      const prev = queryClient.getQueryData<{ items: PortfolioHoldingBatchItem[] }>(
        holdingsKey,
      );
      patchHoldingsHidden(tokenId, false);
      try {
        await unhidePortfolioHolding(address, tokenId);
        void queryClient.invalidateQueries({ queryKey: holdingsKey });
        void queryClient.invalidateQueries({
          queryKey: rq.portfolioDailySnapshots(address),
        });
      } catch (err) {
        if (prev !== undefined) {
          queryClient.setQueryData(holdingsKey, prev);
        } else {
          void queryClient.invalidateQueries({ queryKey: holdingsKey });
        }
        window.alert(err instanceof Error ? err.message : "Failed to unhide card");
      } finally {
        setUnhidingTokenId(null);
      }
    },
    [address, holdingsKey, patchHoldingsHidden, queryClient],
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
