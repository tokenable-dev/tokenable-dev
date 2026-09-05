"use client";

import { useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCollectionBidsByOfferer,
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
import { formatTradeTicketUsdcPrice } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { isLiveAskListing } from "@/lib/marketplace/collectionListingModalHelpers";
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

/** `0` = unlimited. Restore to `1` with the backend env cap. */
export const MAX_ACTIVE_BIDS_PER_COLLECTION = 0;
export const MAX_ACTIVE_BIDS_PER_CARD = MAX_ACTIVE_BIDS_PER_COLLECTION;

export type TokenOfferStep =
  | "idle"
  | "signing"
  | "submitting"
  | "buying"
  | "success"
  | "error";

export type TokenOfferCtaMode = "submit" | "addfunds" | "blocked";

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
    MAX_ACTIVE_BIDS_PER_COLLECTION > 0 &&
    !isReplaceBid &&
    activeBidsOnCard >= MAX_ACTIVE_BIDS_PER_COLLECTION;

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
  const hasListedAsk = isLiveAskListing(listing) && askUsdc > 0;

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
    return "submit";
  }, [bidLimitReached, insufficientFunds]);

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
        text: `Insufficient funds — add $${formatTradeTicketUsdcPrice(shortfallUsdc)} to cover this bid.`,
        tone: "error" as const,
      };
    }
    if (errorMsg) return { text: errorMsg, tone: "error" as const };
    return {
      text: "",
      tone: "muted" as const,
    };
  }, [
    hintError,
    bidLimitReached,
    busy,
    step,
    insufficientFunds,
    shortfallUsdc,
    errorMsg,
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
    setHintError(null);
    setErrorMsg("");
    setPrice(sanitizeTokenBidPriceInput(raw));
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
    ? "Connect wallet"
    : walletSignerMissing
      ? "Open wallet…"
      : busy
        ? busyLabel
        : ctaMode === "addfunds"
          ? "Add funds"
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
    handleSubmit,
    handleAddFunds,
    submitDisabled: bidLimitReached || !priceOk,
  };
}
