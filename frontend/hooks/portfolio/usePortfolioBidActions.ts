"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  cancelOrder,
  rq,
  type OrderListItem,
} from "@/lib/core";
import { invalidateAfterOrderCancel } from "@/lib/core/invalidation";
import { activeRqChainId } from "@/lib/chains";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

export type PortfolioBidCancelMode = "cancel" | "remove_outbid" | "clear_outbid";

export type PortfolioBidCancelTarget = {
  orderHash: string;
  collectionKey: string;
  priceLabel: string;
};

export type PortfolioBidCancelConfirm =
  | {
      mode: "cancel" | "remove_outbid";
      orderHash: string;
      collectionKey: string;
      collectionLabel: string;
      priceLabel: string;
    }
  | {
      mode: "clear_outbid";
      items: PortfolioBidCancelTarget[];
    };

function parsePriceLabel(priceLabel: string): number | undefined {
  const n = Number(priceLabel.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function usePortfolioBidActions(input: {
  /** Wallet that signs / owns the cancel API call. */
  address: string | undefined;
  /** Address used for portfolio-bids query key (may match portfolio view). */
  bidsAddress?: string | undefined;
  queryClient: QueryClient;
  refetchActiveOrders: () => Promise<unknown>;
}) {
  const { address, bidsAddress, queryClient, refetchActiveOrders } = input;
  const chainId = activeRqChainId();
  const bidsCacheAddress = (bidsAddress ?? address)?.trim() || undefined;

  const [cancellingHash, setCancellingHash] = useState<string | null>(null);
  const [clearingOutbid, setClearingOutbid] = useState(false);
  const [cancelConfirm, setCancelConfirm] =
    useState<PortfolioBidCancelConfirm | null>(null);

  const requestCancel = useCallback(
    (
      orderHash: string,
      collectionKey: string,
      collectionLabel: string,
      priceLabel: string,
      mode: "cancel" | "remove_outbid" = "cancel",
    ) => {
      setCancelConfirm({
        mode,
        orderHash,
        collectionKey,
        collectionLabel,
        priceLabel,
      });
    },
    [],
  );

  const requestClearOutbid = useCallback((items: PortfolioBidCancelTarget[]) => {
    if (items.length === 0) return;
    setCancelConfirm({ mode: "clear_outbid", items });
  }, []);

  const closeCancelConfirm = useCallback(() => {
    if (cancellingHash != null || clearingOutbid) return;
    setCancelConfirm(null);
  }, [cancellingHash, clearingOutbid]);

  const patchOutHashes = useCallback(
    (hashes: Set<string>) => {
      const bidsKey = bidsCacheAddress
        ? rq.portfolioBids(bidsCacheAddress, chainId)
        : null;
      const ordersKey = rq.ordersActive(chainId);
      const prevBids = bidsKey
        ? queryClient.getQueryData<OrderListItem[]>(bidsKey)
        : undefined;
      const prevOrders = queryClient.getQueryData<OrderListItem[]>(ordersKey);

      if (bidsKey) {
        queryClient.setQueryData<OrderListItem[]>(bidsKey, (old) =>
          (old ?? []).filter((o) => !hashes.has(o.orderHash)),
        );
      }
      queryClient.setQueryData<OrderListItem[]>(ordersKey, (old) =>
        (old ?? []).filter((o) => !hashes.has(o.orderHash)),
      );

      return { bidsKey, ordersKey, prevBids, prevOrders };
    },
    [bidsCacheAddress, chainId, queryClient],
  );

  const confirmCancel = useCallback(async () => {
    if (!address || cancelConfirm == null) return;

    if (cancelConfirm.mode === "clear_outbid") {
      const { items } = cancelConfirm;
      const hashes = new Set(items.map((i) => i.orderHash));
      setClearingOutbid(true);
      const snapshot = patchOutHashes(hashes);
      setCancelConfirm(null);

      const results = await Promise.allSettled(
        items.map((item) => cancelOrder(item.orderHash, address)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;

      for (let i = 0; i < items.length; i++) {
        if (results[i]?.status !== "fulfilled") continue;
        const item = items[i]!;
        trackEvent("portfolio_bid_cancelled", {
          collection_key: item.collectionKey,
          bid_price: parsePriceLabel(item.priceLabel),
        });
      }

      const collectionKeys = [
        ...new Set(items.map((i) => i.collectionKey).filter(Boolean)),
      ];
      for (const key of collectionKeys) {
        void invalidateAfterOrderCancel(queryClient, key);
      }
      if (snapshot.bidsKey) {
        void queryClient.invalidateQueries({ queryKey: snapshot.bidsKey });
      }
      void refetchActiveOrders();

      if (failed > 0) {
        if (snapshot.bidsKey && snapshot.prevBids !== undefined) {
          // Partial failure — refresh from server rather than full rollback.
          void queryClient.invalidateQueries({ queryKey: snapshot.bidsKey });
        }
        void queryClient.invalidateQueries({ queryKey: snapshot.ordersKey });
        window.alert(
          failed === items.length
            ? "Failed to clear outbid offers. Please try again."
            : `${failed} of ${items.length} outbid offers could not be cleared. Refresh and retry.`,
        );
      }

      setClearingOutbid(false);
      return;
    }

    const { orderHash, collectionKey, priceLabel } = cancelConfirm;
    setCancellingHash(orderHash);
    const snapshot = patchOutHashes(new Set([orderHash]));
    setCancelConfirm(null);

    try {
      await cancelOrder(orderHash, address);
      trackEvent("portfolio_bid_cancelled", {
        collection_key: collectionKey,
        bid_price: parsePriceLabel(priceLabel),
      });
      void invalidateAfterOrderCancel(queryClient, collectionKey);
      if (snapshot.bidsKey) {
        void queryClient.invalidateQueries({ queryKey: snapshot.bidsKey });
      }
      void refetchActiveOrders();
    } catch (err) {
      if (snapshot.bidsKey) {
        if (snapshot.prevBids !== undefined) {
          queryClient.setQueryData(snapshot.bidsKey, snapshot.prevBids);
        } else {
          void queryClient.invalidateQueries({ queryKey: snapshot.bidsKey });
        }
      }
      if (snapshot.prevOrders !== undefined) {
        queryClient.setQueryData(snapshot.ordersKey, snapshot.prevOrders);
      } else {
        void queryClient.invalidateQueries({ queryKey: snapshot.ordersKey });
      }
      window.alert(
        err instanceof Error ? err.message : "Failed to cancel bid",
      );
    } finally {
      setCancellingHash(null);
    }
  }, [address, cancelConfirm, patchOutHashes, queryClient, refetchActiveOrders]);

  return {
    cancellingHash,
    clearingOutbid,
    cancelConfirm,
    requestCancel,
    requestClearOutbid,
    closeCancelConfirm,
    confirmCancel,
  };
}
