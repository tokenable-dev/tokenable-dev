"use client";

import { useCallback, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { PublicClient } from "viem";
import { sepolia } from "viem/chains";
import {
  cancelOrder,
  hidePortfolioHolding,
  rq,
  unhidePortfolioHolding,
  type OrderListItem,
} from "@/lib/core";
import {
  TOKENABLE_RWA_ADDRESS,
  TOKENABLE_RWA_TRANSFER_ABI,
} from "@/constants/contracts";
import type { useWriteContract } from "wagmi";

const TEST_BURN_TO_ADDRESS = "0x88CE98390ACA24C6A232946dc94EC12794f85FB2" as const;

export function usePortfolioHoldingActions(input: {
  address: string | undefined;
  queryClient: QueryClient;
  publicClient: PublicClient | undefined;
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"];
  refetchActiveOrders: () => Promise<unknown>;
}) {
  const { address, queryClient, publicClient, writeContractAsync, refetchActiveOrders } =
    input;

  const [cancellingListingTokenId, setCancellingListingTokenId] = useState<number | null>(
    null,
  );
  const [burningTokenId, setBurningTokenId] = useState<number | null>(null);
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
          queryKey: ["portfolio-daily-snapshots", address],
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
          queryKey: ["portfolio-daily-snapshots", address],
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

  const burnToken = useCallback(
    async (tokenId: number, hasActiveListing: boolean) => {
      if (!address || !publicClient) return;
      if (hasActiveListing) {
        window.alert("Cancel listing first, then burn.");
        return;
      }
      if (
        !window.confirm(
          `Send token #${tokenId} to burn test address ${TEST_BURN_TO_ADDRESS}? This is not reversible.`,
        )
      ) {
        return;
      }
      setBurningTokenId(tokenId);
      try {
        const txHash = await writeContractAsync({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_TRANSFER_ABI,
          functionName: "transferFrom",
          args: [address as `0x${string}`, TEST_BURN_TO_ADDRESS, BigInt(tokenId)],
          chainId: sepolia.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
        await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
        await queryClient.invalidateQueries({ queryKey: rq.ordersActive() });
        await queryClient.invalidateQueries({
          queryKey: ["portfolio-daily-snapshots", address],
        });
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Failed to burn-transfer token",
        );
      } finally {
        setBurningTokenId(null);
      }
    },
    [address, publicClient, queryClient, writeContractAsync],
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
    burningTokenId,
    hidingTokenId,
    unhidingTokenId,
    hideConfirm,
    setHideConfirm,
    executeHideHolding,
    unhideHolding,
    cancelListing,
    burnToken,
    requestHide,
  };
}
