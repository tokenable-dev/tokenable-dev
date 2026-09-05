"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import {
  getActiveOrderForToken,
  getOrderByHash,
  invalidateDeadBidApi,
  type Order,
} from "@/lib/core";
import {
  invalidateAfterAcceptOffer,
  invalidateAfterDeadBid,
} from "@/lib/core/invalidation";
import { useQueryClient } from "@tanstack/react-query";
import { acceptTokenOffer } from "@/lib/seaport/fulfillment/acceptTokenOffer";
import {
  checkBuyerUsdcReadyForBid,
  type BuyerUsdcReadyResult,
} from "@/lib/seaport/fulfillment/runCriteriaMatch";
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import { getChainContracts, type SupportedChainId } from "@/lib/chains";
import { useAppChain } from "@/providers/AppChainProvider";
import { mapWalletError } from "@/lib/network";
import { useAuthStore } from "@/store/authStore";

export type AcceptOfferModalState = {
  bid: Order;
  listing: Order | null;
  assetTitle: string;
  tokenId: number;
};

function looksLikeDeadBidFailure(message: string): boolean {
  return /Buyer USDC|allowance too low|insufficient|listing was not changed|fulfill reverted/i.test(
    message,
  );
}

/**
 * Portfolio Accept-offer flow: resolve bid, preflight buyer USDC, settle without
 * lowering the ask; invalidate dead bids on underfunded / failed settle.
 */
export function usePortfolioAcceptOffer(input: {
  address: string | undefined;
  canSign: boolean;
  refetchActiveOrders: () => Promise<unknown>;
  refetchAssets: () => Promise<unknown>;
}) {
  const { address, canSign, refetchActiveOrders, refetchAssets } = input;
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { chainId } = useAppChain();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const [modal, setModal] = useState<AcceptOfferModalState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyerReady, setBuyerReady] = useState<BuyerUsdcReadyResult | null>(
    null,
  );
  const [preflightPending, setPreflightPending] = useState(false);
  const deepLinkHandledRef = useRef<string | null>(null);
  const deadBidInvalidatedRef = useRef<string | null>(null);

  const closeModal = useCallback(() => {
    if (pending) return;
    setModal(null);
    setError(null);
    setBuyerReady(null);
  }, [pending]);

  const openAcceptOffer = useCallback((state: AcceptOfferModalState) => {
    setError(null);
    setBuyerReady(null);
    setModal(state);
  }, []);

  const tryInvalidateDeadBid = useCallback(
    async (bidHash: string, reasonHint: string) => {
      if (!address) return;
      if (deadBidInvalidatedRef.current === bidHash) return;
      deadBidInvalidatedRef.current = bidHash;
      try {
        await invalidateDeadBidApi(bidHash, address);
        await Promise.all([
          refetchActiveOrders(),
          invalidateAfterDeadBid(queryClient, userId),
        ]);
      } catch (e) {
        // Preflight may race a funded wallet; keep UI error as the primary signal.
        console.warn(
          `[accept-offer] dead-bid invalidate skipped (${reasonHint}):`,
          e instanceof Error ? e.message : e,
        );
        deadBidInvalidatedRef.current = null;
      }
    },
    [address, refetchActiveOrders, queryClient, userId],
  );

  const resolveAndOpen = useCallback(
    async (params: {
      bidOrderHash: string;
      tokenId: number;
      askOrderHash?: string | null;
      assetTitle?: string;
    }) => {
      const bid = await getOrderByHash(params.bidOrderHash);
      if (!isTokenBidOrder(bid) || bid.status !== "active") {
        throw new Error("This offer is not an active token bid.");
      }
      if (String(bid.tokenId) !== String(params.tokenId)) {
        throw new Error("Offer tokenId does not match.");
      }

      let listing: Order | null = null;
      if (params.askOrderHash?.trim()) {
        listing = await getOrderByHash(params.askOrderHash.trim());
      } else {
        listing = await getActiveOrderForToken(params.tokenId);
      }
      if (
        listing &&
        (listing.side !== "ask" ||
          listing.status !== "active" ||
          String(listing.tokenId) !== String(params.tokenId))
      ) {
        listing = null;
      }

      openAcceptOffer({
        bid,
        listing,
        tokenId: params.tokenId,
        assetTitle:
          params.assetTitle?.trim() ||
          `Token #${params.tokenId}`,
      });
    },
    [openAcceptOffer],
  );

  useEffect(() => {
    if (!modal || !publicClient || chainId == null) {
      setBuyerReady(null);
      return;
    }
    let cancelled = false;
    setPreflightPending(true);
    const { usdcAddress } = getChainContracts(chainId as SupportedChainId);
    void checkBuyerUsdcReadyForBid(publicClient, modal.bid, usdcAddress)
      .then(async (ready) => {
        if (cancelled) return;
        setBuyerReady(ready);
        if (!ready.ok) {
          setError(ready.message);
          await tryInvalidateDeadBid(modal.bid.orderHash, ready.code);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setBuyerReady(null);
        setError(
          mapWalletError(e).message ||
            (e instanceof Error ? e.message : "Could not check buyer USDC"),
        );
      })
      .finally(() => {
        if (!cancelled) setPreflightPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [modal, publicClient, chainId, tryInvalidateDeadBid]);

  const confirmAccept = useCallback(async () => {
    if (!modal || !address || !publicClient || chainId == null) {
      setError("Connect your wallet to accept this offer.");
      return;
    }
    if (!canSign) {
      setError("Switch to your linked portfolio wallet to sign.");
      return;
    }
    if (buyerReady && !buyerReady.ok) {
      setError(buyerReady.message);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await acceptTokenOffer({
        address: address as Address,
        publicClient,
        writeContractAsync: writeContractAsync as never,
        bid: modal.bid,
        listing: modal.listing,
        chainId: chainId as SupportedChainId,
      });
      await Promise.all([refetchActiveOrders(), refetchAssets()]);
      await invalidateAfterAcceptOffer(queryClient, {
        tokenId: modal.tokenId,
        collectionKey: modal.listing?.collectionKey ?? modal.bid.collectionKey,
        address,
        userId,
      });
      setModal(null);
      setBuyerReady(null);
    } catch (e) {
      const message =
        mapWalletError(e).message ||
        (e instanceof Error ? e.message : "Accept offer failed");
      setError(message);
      if (looksLikeDeadBidFailure(message)) {
        await tryInvalidateDeadBid(modal.bid.orderHash, "settle_fail");
      }
    } finally {
      setPending(false);
    }
  }, [
    modal,
    address,
    publicClient,
    chainId,
    canSign,
    buyerReady,
    writeContractAsync,
    refetchActiveOrders,
    refetchAssets,
    queryClient,
    userId,
    tryInvalidateDeadBid,
  ]);

  return {
    modal,
    pending,
    preflightPending,
    buyerReady,
    error,
    closeModal,
    openAcceptOffer,
    resolveAndOpen,
    confirmAccept,
    deepLinkHandledRef,
  };
}
