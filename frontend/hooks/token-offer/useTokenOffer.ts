"use client";

import { useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCollectionBidsByOfferer,
  getCollectionMarketSeries,
  marketplaceRqPolicy,
  rq,
  type Order,
} from "@/lib/core";
import { invalidateAfterCriteriaBid } from "@/lib/core/invalidation";
import { SEAPORT_ADDRESS, SEAPORT_ABI, USDC_ABI } from "@/constants/contracts";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import { useSeaportOrderSigner } from "@/lib/privy";
import { mapWalletError } from "@/lib/network";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { askPriceMicros } from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import { runCollectionInstantAskPurchase } from "@/lib/seaport/criteria/runCollectionInstantAskPurchase";
import {
  submitTokenBid,
  TOKEN_BID_DEFAULT_DURATION_DAYS,
  isTokenBidDurationDays,
  resolveTokenBidDurationDays,
  tokenBidDurationSeconds,
  type TokenBidDurationDays,
} from "@/lib/seaport/orders/submitTokenBid";
import {
  isPrivyFiatOnrampFeatureEnabled,
  usePrivyFiatOnramp,
} from "@/hooks/wallet/usePrivyFiatOnramp";
import { isTokenBidOrder } from "@/lib/seaport/orders/isTokenBidOrder";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import { resolveExternalMarketUsd } from "@/lib/market";
import { MARKET_METRICS_SERIES_DURATION } from "@/lib/market/priceChangePeriod";
import {
  isUnlistedTokenBidBelowMarketFloor,
  minUnlistedTokenBidUsdc,
} from "@/lib/marketplace/tokenBidMarketFloor";

/** Digits + optional one decimal place (e.g. `3.5`). Strips commas / extra dots. */
export function sanitizeTokenBidPriceInput(raw: string): string {
  const cleaned = raw.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned;
  const intPart = cleaned.slice(0, dot).replace(/\./g, "");
  const frac = cleaned
    .slice(dot + 1)
    .replace(/\./g, "")
    .replace(/[^0-9]/g, "")
    .slice(0, 1);
  if (cleaned.endsWith(".") && frac === "") return `${intPart}.`;
  return frac ? `${intPart}.${frac}` : intPart;
}

export const MAX_ACTIVE_BIDS_PER_COLLECTION = 1;
export const MAX_ACTIVE_BIDS_PER_CARD = MAX_ACTIVE_BIDS_PER_COLLECTION;
/** Soft floor vs live ask — Card.html `tkbMin` uses 70% of market. */
const MARKET_FLOOR_RATIO = 0.7;

function formatUsdc2(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export type TokenOfferStep =
  | "idle"
  | "signing"
  | "submitting"
  | "buying"
  | "success"
  | "error";

export type TokenOfferCtaMode = "submit" | "addfunds" | "override" | "blocked";

export function useTokenOffer(input: {
  collectionKey: string;
  tokenId: string | number;
  listing: Order;
  collectionBids: Order[];
  connectedAddress?: `0x${string}` | string | null;
  bidToReplace?: Order | null;
  onPlaced?: (order: Order) => void;
  onPurchaseFilled?: () => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
}) {
  const {
    collectionKey,
    tokenId,
    listing,
    collectionBids,
    connectedAddress,
    bidToReplace = null,
    onPlaced,
    onPurchaseFilled,
    onInstantBuyFillUsdc,
  } = input;

  const { address: wagmiAddress, isConnected } = useAccount();
  const address =
    (connectedAddress != null && String(connectedAddress).trim() !== ""
      ? (String(connectedAddress).trim() as `0x${string}`)
      : wagmiAddress) ?? undefined;
  const { chainId } = useAppChain();
  const { usdcAddress } = useChainContracts();
  const publicClient = usePublicClient({ chainId });
  const { signSeaportOrder } = useSeaportOrderSigner();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();
  const fiatOnramp = usePrivyFiatOnramp();

  const tokenIdNorm = normalizeDecimalTokenId(tokenId);
  const isReplaceBid =
    bidToReplace != null &&
    bidToReplace.status === "active" &&
    isTokenBidOrder(bidToReplace);

  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState<TokenBidDurationDays>(
    TOKEN_BID_DEFAULT_DURATION_DAYS,
  );
  const durationDaysRef = useRef(durationDays);
  durationDaysRef.current = durationDays;
  const priceTouchedRef = useRef(false);
  const [softOverride, setSoftOverride] = useState(false);
  const [step, setStep] = useState<TokenOfferStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastOutcome, setLastOutcome] = useState<"instant" | "bid" | null>(null);
  const [hintError, setHintError] = useState<string | null>(null);

  const myBidsQuery = useQuery({
    queryKey: rq.portfolioBids(address ?? "", chainId),
    queryFn: () => getCollectionBidsByOfferer(address!),
    enabled: Boolean(address?.trim()) && !isReplaceBid,
    staleTime: 15_000,
  });

  const activeBidsOnCard = useMemo(() => {
    const ck = collectionKey.trim().toLowerCase();
    const fromBook = collectionBids.filter(
      (o) =>
        o.status === "active" &&
        isTokenBidOrder(o) &&
        (o.collectionKey ?? "").trim().toLowerCase() === ck &&
        Boolean(address) &&
        o.offerer.toLowerCase() === address!.toLowerCase(),
    );
    if (fromBook.length > 0) return fromBook.length;
    const fromApi = (myBidsQuery.data ?? []).filter(
      (o) =>
        o.status === "active" &&
        o.side === "bid" &&
        (o.collectionKey ?? "").trim().toLowerCase() === ck,
    );
    return fromApi.length;
  }, [collectionBids, myBidsQuery.data, address, collectionKey]);

  const bidLimitReached =
    !isReplaceBid && activeBidsOnCard >= MAX_ACTIVE_BIDS_PER_COLLECTION;

  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const { data: usdcBalRaw } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const { data: usdcAllowanceRaw } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, SEAPORT_ADDRESS] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const balanceUsdc = useMemo(() => {
    if (usdcBalRaw == null) return null;
    return Number(formatUnits(usdcBalRaw as bigint, 6));
  }, [usdcBalRaw]);

  const askMicros = askPriceMicros(listing);
  const askUsdc = Number(formatUnits(askMicros, 6));
  const hasListedAsk = askUsdc > 0;
  const askSoftFloorUsdc = hasListedAsk ? askUsdc * MARKET_FLOOR_RATIO : 0;

  const marketSeriesQuery = useQuery({
    queryKey: rq.collectionMarketSeries(
      collectionKey,
      MARKET_METRICS_SERIES_DURATION,
      chainId,
    ),
    queryFn: () =>
      getCollectionMarketSeries(collectionKey, MARKET_METRICS_SERIES_DURATION),
    enabled: !hasListedAsk && collectionKey.trim().length > 0,
    staleTime: marketplaceRqPolicy.marketSeriesStaleMs,
  });

  const unlistedMarketUsd = useMemo(() => {
    if (hasListedAsk) return null;
    const series = marketSeriesQuery.data;
    if (!series) return null;
    const resolved = resolveExternalMarketUsd({
      marketPreview: series.cardhedgerPreview ?? null,
      gradePrices: series.gradePrices ?? null,
      gradeScore: 10,
      spotPriceBasis: series.spotPriceBasis ?? null,
    });
    return resolved.usd != null && resolved.usd > 0 ? resolved.usd : null;
  }, [hasListedAsk, marketSeriesQuery.data]);

  const unlistedMarketFloorUsdc =
    unlistedMarketUsd != null ? minUnlistedTokenBidUsdc(unlistedMarketUsd) : 0;
  const marketFloorUsdc = hasListedAsk ? askSoftFloorUsdc : unlistedMarketFloorUsdc;

  const priceOk = useMemo(() => {
    const n = parseFloat(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0;
  }, [price]);

  const priceUsdc = useMemo(() => {
    const n = parseFloat(price.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [price]);

  const priceInUnits = useMemo(() => {
    if (!priceOk) return null;
    try {
      // Prefer the sanitized input string so one-decimal amounts stay exact in micros.
      const normalized = sanitizeTokenBidPriceInput(price).replace(/\.$/, "");
      if (!normalized) return null;
      return parseUnits(normalized, 6);
    } catch {
      return null;
    }
  }, [priceOk, price]);

  const crossesAsk =
    hasListedAsk && priceOk && priceInUnits != null && priceInUnits >= askMicros;
  const belowSoftFloor =
    hasListedAsk &&
    priceOk &&
    !crossesAsk &&
    priceUsdc < askSoftFloorUsdc &&
    !softOverride;
  const belowHardMarketFloor =
    !hasListedAsk &&
    priceOk &&
    unlistedMarketFloorUsdc > 0 &&
    isUnlistedTokenBidBelowMarketFloor(priceUsdc, unlistedMarketUsd);
  const insufficientFunds =
    priceOk &&
    priceInUnits != null &&
    usdcBalRaw != null &&
    (usdcBalRaw as bigint) < priceInUnits;

  const shortfallUsdc =
    insufficientFunds && balanceUsdc != null
      ? Math.max(0, priceUsdc - balanceUsdc)
      : 0;

  const ctaMode: TokenOfferCtaMode = useMemo(() => {
    if (bidLimitReached) return "blocked";
    if (insufficientFunds) return "addfunds";
    if (belowSoftFloor) return "override";
    return "submit";
  }, [bidLimitReached, insufficientFunds, belowSoftFloor]);

  const busy =
    step === "signing" ||
    step === "submitting" ||
    step === "buying" ||
    fiatOnramp.inFlight;

  const policyHint = useMemo(() => {
    if (hintError) return { text: hintError, tone: "error" as const };
    // After a successful submit, invalidate refreshes the book and briefly
    // makes bidLimitReached true while still on the form — suppress that flash.
    if (bidLimitReached && !busy && step !== "success") {
      return {
        text: `You already have an active bid on this collection. Cancel or edit it to place a new one.`,
        tone: "error" as const,
      };
    }
    if (insufficientFunds) {
      return {
        text: `Insufficient funds — add $${formatUsdc2(shortfallUsdc)} to cover this bid.`,
        tone: "error" as const,
      };
    }
    if (belowHardMarketFloor) {
      return {
        text: `Bid must be at least $${formatUsdc2(unlistedMarketFloorUsdc)} (70% of market).`,
        tone: "error" as const,
      };
    }
    if (belowSoftFloor) {
      return {
        text: `Bid is below the $${formatUsdc2(askSoftFloorUsdc)} minimum (70% of market). Continue anyway?`,
        tone: "warn" as const,
      };
    }
    if (errorMsg) return { text: errorMsg, tone: "error" as const };
    if (!hasListedAsk) {
      if (unlistedMarketFloorUsdc > 0) {
        return {
          text: `Min bid $${formatUsdc2(unlistedMarketFloorUsdc)} (70% of market) · No bid fee, 5% on sale only`,
          tone: "muted" as const,
        };
      }
      return {
        text: "No bid fee · 5% charged on sale only",
        tone: "muted" as const,
      };
    }
    return {
      text: `Min bid $${formatUsdc2(askSoftFloorUsdc)} (70% of market) · No bid fee, 5% on sale only`,
      tone: "muted" as const,
    };
  }, [
    hintError,
    bidLimitReached,
    busy,
    step,
    insufficientFunds,
    shortfallUsdc,
    belowHardMarketFloor,
    unlistedMarketFloorUsdc,
    belowSoftFloor,
    askSoftFloorUsdc,
    errorMsg,
    hasListedAsk,
  ]);

  const busyLabel =
    step === "buying"
      ? "Buying…"
      : step === "signing" || step === "submitting"
        ? "Placing bid…"
        : fiatOnramp.inFlight
          ? "Opening Add Funds…"
          : "Place bid";

  const walletSignerMissing = Boolean(address) && !signSeaportOrder;

  const invalidateAfter = async () => {
    await invalidateAfterCriteriaBid(queryClient, collectionKey);
  };

  const durationSeconds = tokenBidDurationSeconds(durationDays);

  const setDurationDaysSafe = (days: number) => {
    if (!isTokenBidDurationDays(days)) return;
    setHintError(null);
    setErrorMsg("");
    setDurationDays(days);
    durationDaysRef.current = days;
  };

  const setPriceDigits = (raw: string) => {
    priceTouchedRef.current = true;
    setSoftOverride(false);
    setHintError(null);
    setErrorMsg("");
    setPrice(sanitizeTokenBidPriceInput(raw));
  };

  const handleAdjustBid = () => {
    setSoftOverride(false);
    setHintError(null);
  };

  const handleAddFunds = async () => {
    setHintError(null);
    if (!isPrivyFiatOnrampFeatureEnabled()) {
      setHintError("Add Funds is not available in this environment.");
      return;
    }
    const ok = await fiatOnramp.startFunding(address);
    if (!ok && fiatOnramp.lastError) {
      setHintError(fiatOnramp.lastError);
    }
  };

  const handleSubmit = async () => {
    setHintError(null);
    setErrorMsg("");

    if (!publicClient) {
      setErrorMsg("Network not ready. Refresh or switch network in the header.");
      return;
    }
    if (!address) {
      setErrorMsg("Connect your wallet.");
      return;
    }
    if (!priceOk || priceInUnits == null) {
      setHintError("Enter a bid amount to continue.");
      return;
    }
    if (bidLimitReached) {
      setStep("error");
      return;
    }
    if (insufficientFunds) {
      await handleAddFunds();
      return;
    }
    if (belowHardMarketFloor) {
      return;
    }
    // "Bid anyway" — accept soft floor and continue in the same click.
    if (belowSoftFloor) {
      setSoftOverride(true);
    }

    if (crossesAsk) {
      setStep("buying");
      try {
        await ensureAccountWalletReady();
        const paid = await runCollectionInstantAskPurchase({
          ask: listing,
          address,
          publicClient,
          writeContractAsync,
          chainId,
        });
        setLastOutcome("instant");
        const purchasePrice = paid ?? askUsdc;
        const purchaseFee = Math.round(purchasePrice * 0.05 * 100) / 100;
        trackEvent("purchase_completed", {
          card_id: String(tokenIdNorm),
          price: purchasePrice,
          fee: purchaseFee,
          net_amount: Math.round(purchasePrice * 0.95 * 100) / 100,
        });
        if (paid != null) onInstantBuyFillUsdc?.(paid);
        // Flip to success before cache refresh so limit/policy UI cannot flash.
        setStep("success");
        await invalidateAfter();
        onPurchaseFilled?.();
      } catch (e: unknown) {
        setErrorMsg(mapWalletError(e).message);
        setStep("error");
      }
      return;
    }

    if (!signSeaportOrder) {
      setErrorMsg("Wallet not ready to sign. Reconnect your wallet and try again.");
      return;
    }
    if (counter === undefined) {
      setErrorMsg("Could not read Seaport counter.");
      return;
    }
    if (usdcBalRaw == null) {
      setErrorMsg("Could not read USDC balance.");
      setStep("error");
      return;
    }

    try {
      await ensureAccountWalletReady();
      setStep(isReplaceBid ? "submitting" : "signing");
      // Re-read after wallet prompts so Valid-for selection is never stale.
      const selectedDurationDays = resolveTokenBidDurationDays(
        durationDaysRef.current,
      );
      const result = await submitTokenBid({
        collectionKey,
        tokenId: tokenIdNorm,
        address,
        publicClient,
        signSeaportOrder,
        writeContractAsync,
        bidUnits: priceInUnits,
        counter: counter as bigint,
        usdcAllowanceRaw: usdcAllowanceRaw as bigint | undefined,
        chainId,
        durationDays: selectedDurationDays,
        mode: isReplaceBid ? "replace" : "create",
        oldOrderHash: isReplaceBid ? bidToReplace!.orderHash : undefined,
      });
      setLastOutcome("bid");
      trackEvent("bid_submitted", {
        card_id: String(tokenIdNorm),
        bid_amount: priceUsdc,
      });
      // Flip to success before cache refresh so the just-placed bid is not
      // momentarily treated as "already have an active bid" on the form.
      setStep("success");
      await invalidateAfter();
      onPlaced?.(result.order);
    } catch (e: unknown) {
      setErrorMsg(mapWalletError(e).message);
      setStep("error");
    }
  };

  const ctaLabel = !address
    ? "Connect wallet to bid"
    : walletSignerMissing
      ? "Open wallet…"
      : busy
        ? busyLabel
        : ctaMode === "addfunds"
          ? "Add funds"
          : ctaMode === "override"
            ? "Bid anyway"
            : ctaMode === "blocked"
              ? "Maximum bids reached"
              : crossesAsk
                ? "Buy at listed price"
                : "Place bid";

  return {
    address,
    isConnected,
    price,
    setPriceDigits,
    durationDays,
    setDurationDays: setDurationDaysSafe,
    durationSeconds,
    priceTouchedRef,
    priceOk,
    priceUsdc,
    askUsdc,
    marketFloorUsdc,
    unlistedMarketFloorUsdc,
    hasListedAsk,
    balanceUsdc,
    step,
    lastOutcome,
    errorMsg,
    policyHint,
    ctaMode,
    ctaLabel,
    busy,
    walletSignerMissing,
    softOverride,
    handleSubmit,
    handleAdjustBid,
    handleAddFunds,
    submitDisabled: bidLimitReached || !priceOk || belowHardMarketFloor,
    belowHardMarketFloor,
  };
}
