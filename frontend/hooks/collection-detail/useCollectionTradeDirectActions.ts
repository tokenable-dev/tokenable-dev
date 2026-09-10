"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import {
  getCollectionBidAnchorTokenIds,
  getOrderByHash,
  getRwaSettlementPolicy,
  type Order,
} from "@/lib/core";
import {
  invalidateAfterCriteriaBid,
  invalidateAfterRwaDetail,
} from "@/lib/core/invalidation";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import { useSeaportOrderSigner } from "@/lib/privy";
import { mapWalletError } from "@/lib/network";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import { submitTokenBid, TOKEN_BID_DEFAULT_DURATION_DAYS } from "@/lib/seaport/orders/submitTokenBid";
import { runCollectionInstantAskPurchase } from "@/lib/seaport/criteria/runCollectionInstantAskPurchase";
import {
  askPriceMicros,
  BidCrossesLiveAskError,
  fetchCrossingAskForBid,
} from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import { submitAskListingOrder } from "@/lib/seaport/orders/submitAskListing";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  invalidateListingQueries,
  runPostListInstantMatch,
  type ListRwaInstantMatchDeps,
} from "@/lib/seaport/listing/listRwaInstantMatch";
import { orderCollectionKey } from "@/lib/seaport/listing/listRwaModalUtils";
import type { MatchWriteContractAsync } from "@/lib/seaport/fulfillment/runCriteriaMatch";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ABI,
} from "@/constants/contracts";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { feePercent } from "@/lib/seaport/orders/platformFee";
import { useToastStore } from "@/store/toastStore";

export type CollectionTradeBusy = "buy" | "bid" | "sell" | null;

function moneyLabel(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export type CollectionTradeToastMeta = {
  cardTitle?: string | null;
  certNumber?: string | null;
};

function vaultAccentLine(certNumber?: string | null): string {
  const cert = certNumber?.trim();
  return cert ? `In vault · Cert ${cert}` : "In vault";
}

/**
 * Card.html `#tk-trade` CTAs — no checkout / confirm sheet.
 * Tap → Privy sign (or fulfill tx) → toast.
 */
export function useCollectionTradeDirectActions(input: {
  collectionKey: string;
  askMap: Map<number, Order>;
  collectionBids: Order[];
  onInvalidate: () => void;
  toastCardTitle?: string | null;
  certNumberForToken?: (tokenId: number) => string | null;
}) {
  const {
    collectionKey,
    askMap,
    collectionBids,
    onInvalidate,
    toastCardTitle,
    certNumberForToken,
  } = input;
  const { address } = useAccount();
  const { chainId } = useAppChain();
  const { usdcAddress } = useChainContracts();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const { signSeaportOrder } = useSeaportOrderSigner();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const queryClient = useQueryClient();
  const pushToast = useToastStore((s) => s.push);

  const signSeaportOrderRef = useRef(signSeaportOrder);
  signSeaportOrderRef.current = signSeaportOrder;

  const [busy, setBusy] = useState<CollectionTradeBusy>(null);

  const matchWrite = useMemo(
    () =>
      ((args: Parameters<MatchWriteContractAsync>[0]) =>
        writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0],
        )) as MatchWriteContractAsync,
    [writeContractAsync],
  );

  const resolveToastMeta = useCallback(
    (tokenId: number, override?: CollectionTradeToastMeta): CollectionTradeToastMeta => ({
      cardTitle: override?.cardTitle ?? toastCardTitle ?? null,
      certNumber:
        override?.certNumber ?? certNumberForToken?.(tokenId) ?? null,
    }),
    [toastCardTitle, certNumberForToken],
  );

  const resolveBidTokenId = useCallback(async (): Promise<number | null> => {
    const asks = [...askMap.values()].filter((o) => o.status === "active");
    asks.sort((a, b) => {
      try {
        const pa = BigInt(a.considerationAmount);
        const pb = BigInt(b.considerationAmount);
        if (pa === pb) return Number(a.tokenId) - Number(b.tokenId);
        return pa < pb ? -1 : 1;
      } catch {
        return Number(a.tokenId) - Number(b.tokenId);
      }
    });
    const floor = asks[0];
    if (floor?.tokenId != null) {
      const tid = Number(floor.tokenId);
      if (Number.isFinite(tid) && tid >= 0) return tid;
    }
    const fromBids = collectionBids
      .map((o) => Number(o.tokenId))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    if (fromBids[0] != null) return fromBids[0];
    try {
      const snap = await getCollectionBidAnchorTokenIds(collectionKey);
      const ids = [...(snap.tokenIds ?? [])]
        .map(Number)
        .filter((n) => Number.isFinite(n) && n >= 0)
        .sort((a, b) => a - b);
      return ids[0] ?? null;
    } catch {
      return null;
    }
  }, [askMap, collectionBids, collectionKey]);

  const buyToken = useCallback(
    async (tokenId: number, toastMeta?: CollectionTradeToastMeta) => {
      const ask = askMap.get(tokenId);
      if (!ask || ask.status !== "active" || !publicClient) return;
      if (busy) return;
      setBusy("buy");
      try {
        const signerAddress = await ensureAccountWalletReady();
        await fulfillAskListingOrder({
          ask,
          address: signerAddress as Address,
          publicClient,
          writeContractAsync: writeContractAsync as Parameters<
            typeof fulfillAskListingOrder
          >[0]["writeContractAsync"],
          chainId,
        });
        const priceUsdc = Number(ask.considerationAmount) / 1_000_000;
        const fee = Math.round(priceUsdc * 0.05 * 100) / 100;
        trackEvent("purchase_completed", {
          card_id: String(tokenId),
          price: priceUsdc,
          fee,
          net_amount: Math.round(priceUsdc * 0.95 * 100) / 100,
        });
        await invalidateAfterRwaDetail(queryClient, {
          tokenId,
          collectionKeyForMatch: collectionKey,
          portfolioWallets: [signerAddress, ask.offerer],
          marketplaceBuy: {
            wallet: signerAddress,
            tokenId,
            costBasisUsd: priceUsdc,
            chainId,
          },
        });
        onInvalidate();
        const meta = resolveToastMeta(tokenId, toastMeta);
        const cardTitle = meta.cardTitle?.trim() || null;
        pushToast({
          tone: "positive",
          title: "Purchased",
          cardTitle,
          accentLine: vaultAccentLine(meta.certNumber),
          href: "/portfolio?tab=assets",
          ctaLabel: "View in Portfolio →",
          ctaInline: true,
          durationMs: 5000,
        });
      } catch (e: unknown) {
        pushToast({
          tone: "danger",
          title: "Purchase failed",
          message: mapWalletError(e).message,
        });
      } finally {
        setBusy(null);
      }
    },
    [
      askMap,
      publicClient,
      busy,
      ensureAccountWalletReady,
      writeContractAsync,
      chainId,
      queryClient,
      collectionKey,
      onInvalidate,
      pushToast,
      resolveToastMeta,
    ],
  );

  const placeBid = useCallback(
    async (priceUsd: number, toastMeta?: CollectionTradeToastMeta) => {
      if (!(priceUsd > 0) || !publicClient || !address) return;
      if (busy) return;
      if (!signSeaportOrder) {
        pushToast({
          tone: "warning",
          title: "Wallet not ready",
          message: "Reconnect your wallet and try again.",
        });
        return;
      }

      const bidWhole = Math.round(priceUsd);
      const bidUnits = parseUnits(String(bidWhole), 6);
      setBusy("bid");
      try {
        const floorAsk = await fetchCrossingAskForBid({
          collectionKey,
          bidder: address,
          bidUnits,
        });

        const finishInstantBuy = async (ask: Order) => {
          const signerAddress = await ensureAccountWalletReady();
          const paid = await runCollectionInstantAskPurchase({
            ask,
            address: signerAddress as Address,
            publicClient,
            writeContractAsync,
            chainId,
          });
          const purchasePrice =
            paid ?? Number(formatUnits(askPriceMicros(ask), 6));
          const tokenId = Number(ask.tokenId);
          const fee = Math.round(purchasePrice * 0.05 * 100) / 100;
          trackEvent("purchase_completed", {
            card_id: String(tokenId),
            price: purchasePrice,
            fee,
            net_amount: Math.round(purchasePrice * 0.95 * 100) / 100,
          });
          await invalidateAfterRwaDetail(queryClient, {
            tokenId,
            collectionKeyForMatch: collectionKey,
            portfolioWallets: [signerAddress, ask.offerer],
            marketplaceBuy: {
              wallet: signerAddress,
              tokenId,
              costBasisUsd: purchasePrice,
              chainId,
            },
          });
          onInvalidate();
          const meta = resolveToastMeta(tokenId, toastMeta);
          const cardTitle = meta.cardTitle?.trim() || null;
          pushToast({
            tone: "positive",
            title: "Purchased",
            cardTitle,
            accentLine: vaultAccentLine(meta.certNumber),
            href: "/portfolio?tab=assets",
            ctaLabel: "View in Portfolio →",
            ctaInline: true,
            durationMs: 5000,
          });
        };

        if (floorAsk) {
          setBusy("buy");
          try {
            await finishInstantBuy(floorAsk);
          } catch (e: unknown) {
            pushToast({
              tone: "danger",
              title: "Purchase failed",
              message: mapWalletError(e).message,
            });
          }
          return;
        }

        const tokenId = await resolveBidTokenId();
        if (tokenId == null) {
          throw new Error("No card in this collection to bid on yet.");
        }
        await ensureAccountWalletReady();
        const [counter, usdcAllowanceRaw, usdcBalRaw] = await Promise.all([
          publicClient.readContract({
            address: SEAPORT_ADDRESS,
            abi: SEAPORT_ABI,
            functionName: "getCounter",
            args: [address as Address],
          }),
          publicClient.readContract({
            address: usdcAddress,
            abi: USDC_ABI,
            functionName: "allowance",
            args: [address as Address, SEAPORT_ADDRESS],
          }),
          publicClient.readContract({
            address: usdcAddress,
            abi: USDC_ABI,
            functionName: "balanceOf",
            args: [address as Address],
          }),
        ]);
        if (usdcBalRaw < bidUnits) {
          throw new Error(
            `Insufficient USDC. Need ${moneyLabel(priceUsd)} — add funds and try again.`,
          );
        }
        try {
          await submitTokenBid({
            collectionKey,
            tokenId,
            address: address as Address,
            publicClient,
            signSeaportOrder,
            writeContractAsync,
            bidUnits,
            counter: counter as bigint,
            usdcAllowanceRaw: usdcAllowanceRaw as bigint,
            chainId,
            durationDays: TOKEN_BID_DEFAULT_DURATION_DAYS,
            mode: "create",
          });
        } catch (e: unknown) {
          if (e instanceof BidCrossesLiveAskError) {
            setBusy("buy");
            try {
              await finishInstantBuy(e.ask);
            } catch (buyErr: unknown) {
              pushToast({
                tone: "danger",
                title: "Purchase failed",
                message: mapWalletError(buyErr).message,
              });
            }
            return;
          }
          throw e;
        }
        trackEvent("bid_submitted", {
          card_id: String(tokenId),
          bid_amount: priceUsd,
        });
        await invalidateAfterCriteriaBid(queryClient, collectionKey, {
          portfolioWallets: [address],
        });
        onInvalidate();
        pushToast({
          tone: "positive",
          title: "Bid placed",
          message: `Your bid of ${moneyLabel(priceUsd)} is live.`,
          durationMs: 3000,
        });
      } catch (e: unknown) {
        pushToast({
          tone: "danger",
          title: "Bid failed",
          message: mapWalletError(e).message,
        });
      } finally {
        setBusy(null);
      }
    },
    [
      publicClient,
      address,
      busy,
      signSeaportOrder,
      resolveBidTokenId,
      ensureAccountWalletReady,
      usdcAddress,
      collectionKey,
      writeContractAsync,
      chainId,
      queryClient,
      onInvalidate,
      pushToast,
      resolveToastMeta,
    ],
  );

  const listForSale = useCallback(
    async (
      tokenId: number,
      priceUsd: number,
      opts?: CollectionTradeToastMeta,
    ) => {
      if (!(priceUsd > 0) || !publicClient || !address) return;
      if (busy) return;
      if (!signSeaportOrder) {
        pushToast({
          tone: "warning",
          title: "Wallet not ready",
          message: "Reconnect your wallet and try again.",
        });
        return;
      }
      setBusy("sell");
      const priceUsdc = String(Math.round(priceUsd));
      try {
        await ensureAccountWalletReady();
        const settlementPolicy = (
          await getRwaSettlementPolicy(tokenId)
        ).settlementPolicy;
        if (!settlementPolicy) {
          throw new Error(
            "Vault custody is unknown for this token — refresh and try again.",
          );
        }

        let created = await submitAskListingOrder({
          tokenId,
          priceUsdc,
          address: address as Address,
          publicClient,
          signSeaportOrder,
          writeContractAsync: writeContractAsync as Parameters<
            typeof submitAskListingOrder
          >[0]["writeContractAsync"],
          chainId,
          mode: "create",
          settlementPolicy,
        });
        if (!orderCollectionKey(created) && created.orderHash) {
          try {
            const refreshed = await getOrderByHash(created.orderHash);
            if (orderCollectionKey(refreshed)) created = refreshed;
          } catch {
            /* keep created */
          }
        }

        const tokenIdNorm = normalizeDecimalTokenId(tokenId);
        const askMicros = parseUnits(priceUsdc, 6);
        const topRows = collectionBids.filter((b) => {
          if (b.status !== "active") return false;
          if (isTokenBidOrder(b)) {
            return normalizeDecimalTokenId(b.tokenId) === tokenIdNorm;
          }
          return isCriteriaCollectionBid(b);
        });
        topRows.sort((a, b) => {
          const da = bidUsdcAmount(a);
          const db = bidUsdcAmount(b);
          if (da > db) return -1;
          if (da < db) return 1;
          return 0;
        });
        const top = topRows[0];
        const preferredExact = topRows.find((b) => bidUsdcAmount(b) === askMicros);

        const instantMatchDeps: ListRwaInstantMatchDeps = {
          tokenId,
          address: address as Address,
          publicClient,
          collectionKey,
          collectionBids,
          preferredBidForMatch: preferredExact
            ? String(preferredExact.orderHash)
            : top
              ? String(top.orderHash)
              : null,
          topCollectionBid: top ? { micros: bidUsdcAmount(top) } : null,
          resolvedExistingAsk: null,
          getSignSeaportOrder: () => signSeaportOrderRef.current,
          writeContractAsync: matchWrite,
          queryClient,
          chainId,
        };

        const match = await runPostListInstantMatch(instantMatchDeps, created);
        if (match.matched) {
          const salePrice = parseFloat(priceUsdc);
          trackEvent("sell_now_completed", {
            card_id: String(tokenId),
            price: salePrice,
            fee: Math.round(salePrice * 0.05 * 100) / 100,
            net_amount: Math.round(salePrice * 0.95 * 100) / 100,
          });
          const soldTitle = resolveToastMeta(tokenId, opts).cardTitle?.trim() || null;
          pushToast({
            tone: "positive",
            title: "Sold",
            lead: soldTitle ? "Sold " : undefined,
            cardTitle: soldTitle,
            trail: ` for ${moneyLabel(salePrice)}`,
            href: "/portfolio?tab=assets",
            ctaLabel: "View in Portfolio →",
            ctaInline: true,
            durationMs: 6000,
          });
        } else {
          trackEvent("listing_submitted", {
            card_id: String(tokenId),
            asking_price: parseFloat(priceUsdc),
          });
          const listedAt = parseFloat(priceUsdc);
          const feePct =
            settlementPolicy === "self_vault_hold"
              ? 5
              : feePercent(settlementPolicy);
          const feeN = Math.round((listedAt * feePct) / 100);
          const netN = listedAt - feeN;
          const listedTitle = resolveToastMeta(tokenId, opts).cardTitle?.trim() || null;
          pushToast({
            tone: "positive",
            title: "Listed",
            lead: listedTitle ? "Listed " : "Listed",
            cardTitle: listedTitle,
            trail: ` at ${moneyLabel(listedAt)}`,
            mutedLine: `You receive ${moneyLabel(netN)} · after ${feePct}% fee`,
            durationMs: 6000,
          });
        }

        await invalidateListingQueries(instantMatchDeps, created, {
          ownershipMoved: match.matched,
        });
        onInvalidate();
      } catch (e: unknown) {
        pushToast({
          tone: "danger",
          title: "Listing failed",
          message: mapWalletError(e).message,
        });
      } finally {
        setBusy(null);
      }
    },
    [
      publicClient,
      address,
      busy,
      signSeaportOrder,
      ensureAccountWalletReady,
      writeContractAsync,
      chainId,
      collectionBids,
      collectionKey,
      matchWrite,
      queryClient,
      onInvalidate,
      pushToast,
      resolveToastMeta,
    ],
  );

  return {
    busy,
    buyToken,
    placeBid,
    listForSale,
  };
}
