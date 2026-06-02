"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatUnits, type Address } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import { getMerkleEligibleTokenIds, type Order } from "@/lib/core";
import { mapWalletError } from "@/lib/network";
import { askPriceMicros, pickLowestActiveAsk } from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import { useCriteriaBidFloorAsks } from "./useCriteriaBidFloorAsks";
import { invalidateCollectionCriteriaBidQueries } from "@/lib/seaport/criteria/invalidateCollectionCriteriaBidQueries";
import { runCollectionInstantAskPurchase } from "@/lib/seaport/criteria/runCollectionInstantAskPurchase";
import { submitCollectionCriteriaBid } from "@/lib/seaport/criteria/submitCollectionCriteriaBid";
import type { CollectionCriteriaBidStep } from "@/lib/marketplace/collectionCriteriaBidTypes";

export function useCollectionCriteriaBid(input: {
  collectionKey: string;
  activeAsks: Order[];
  connectedAddress?: `0x${string}` | string | null;
  presetPriceFromBook?: string | null;
  onPlaced?: (order: Order) => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onPurchaseFilled?: () => void;
}) {
  const {
    collectionKey,
    activeAsks,
    connectedAddress,
    presetPriceFromBook,
    onPlaced,
    onInstantBuyFillUsdc,
    onPurchaseFilled,
  } = input;

  const { address: wagmiAddress, isConnected } = useAccount();
  const address =
    (connectedAddress != null && String(connectedAddress).trim() !== ""
      ? (String(connectedAddress).trim() as `0x${string}`)
      : wagmiAddress) ?? undefined;
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const {
    data: merkleSet,
    isLoading: merkleLoading,
    isError: merkleIsError,
  } = useQuery({
    queryKey: ["merkle-set", collectionKey],
    queryFn: () => getMerkleEligibleTokenIds(collectionKey),
    enabled: String(collectionKey ?? "").trim().length > 0,
    staleTime: 30_000,
  });

  const merkleLeafTokenIds = merkleSet?.tokenIds ?? [];

  const floor = useCriteriaBidFloorAsks({
    collectionKey,
    activeAsks,
    presetPriceFromBook,
  });

  const [step, setStep] = useState<CollectionCriteriaBidStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastOutcome, setLastOutcome] = useState<"instant" | "bid" | null>(null);
  const [postBidMatchHint, setPostBidMatchHint] = useState<string | null>(null);

  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcBalRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcAllowanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, SEAPORT_ADDRESS] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const balanceUsdc = useMemo(() => {
    if (usdcBalRaw == null) return null;
    return Number(formatUnits(usdcBalRaw as bigint, 6));
  }, [usdcBalRaw]);

  const canPlaceCriteriaBid =
    merkleLeafTokenIds.length > 0 && counter !== undefined && !merkleLoading && !merkleIsError;

  const invalidateAfterTrade = async () => {
    await invalidateCollectionCriteriaBidQueries(queryClient, collectionKey);
  };

  const runInstantPurchase = async (ask: Order) => {
    if (!address || !publicClient) return;
    setStep("buying");
    setErrorMsg("");
    try {
      const paid = await runCollectionInstantAskPurchase({
        ask,
        address,
        publicClient,
        writeContractAsync,
      });
      setLastOutcome("instant");
      setStep("success");
      if (paid != null) onInstantBuyFillUsdc?.(paid);
      onPlaced?.(ask);
      onPurchaseFilled?.();
      void invalidateAfterTrade();
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(mapWalletError(e).message);
    }
  };

  const handleSubmit = async () => {
    if (!publicClient) {
      setErrorMsg("Network not ready. Refresh or switch to Sepolia.");
      return;
    }
    if (!address) {
      setErrorMsg("Connect your wallet.");
      return;
    }
    if (!floor.priceOk || floor.priceInUnits == null) {
      setErrorMsg("Enter a valid USDC amount.");
      return;
    }

    const lowest = floor.lowestAsk ?? pickLowestActiveAsk(activeAsks);
    const willFill = lowest != null && floor.priceInUnits >= askPriceMicros(lowest);

    if (willFill && lowest) {
      if (floor.lowestAskCandidates.length >= 2 && !floor.showAskChooserModal) {
        floor.setShowAskChooserModal(true);
        return;
      }
      setErrorMsg("");
      try {
        await runInstantPurchase(lowest);
        floor.setShowAskChooserModal(false);
      } catch (e: unknown) {
        setErrorMsg(mapWalletError(e).message);
        setStep("error");
      }
      return;
    }

    if (!walletClient) {
      setErrorMsg("Wallet not ready to sign. Unlock MetaMask and try again.");
      return;
    }

    if (counter === undefined) {
      setErrorMsg("Could not read Seaport counter.");
      return;
    }
    if (merkleLeafTokenIds.length === 0) {
      setErrorMsg(
        merkleIsError
          ? "Could not load Merkle token set for this collection. Retry in a moment."
          : "No minted RWAs map to this collection bucket — you cannot place a criteria bid here.",
      );
      return;
    }

    setErrorMsg("");
    setPostBidMatchHint(null);

    try {
      setStep("signing");
      const result = await submitCollectionCriteriaBid({
        collectionKey,
        address,
        publicClient,
        walletClient,
        writeContractAsync,
        bidUnits: floor.priceInUnits,
        merkleLeafTokenIds,
        counter: counter as bigint,
        usdcAllowanceRaw: usdcAllowanceRaw as bigint | undefined,
        activeAsks,
      });

      setStep("matching");
      if (result.outcome === "instant") {
        setLastOutcome("instant");
        if (result.fillUsdc != null) onInstantBuyFillUsdc?.(result.fillUsdc);
        setPostBidMatchHint(null);
        onPurchaseFilled?.();
      } else {
        setLastOutcome("bid");
        setPostBidMatchHint(result.matchHint ?? null);
      }
      setStep("success");
      onPlaced?.(result.order);
      void invalidateAfterTrade();
    } catch (e: unknown) {
      setErrorMsg(mapWalletError(e).message);
      setStep("error");
    }
  };

  const busy = step !== "idle" && step !== "success" && step !== "error";
  const needsWalletSigner = !floor.crossesBook;
  const walletSignerMissing = needsWalletSigner && isConnected && !walletClient;

  const submitDisabled =
    busy ||
    !address ||
    !publicClient ||
    !floor.priceOk ||
    walletSignerMissing ||
    (!floor.crossesBook && (!canPlaceCriteriaBid || merkleLoading));

  const busyLabel =
    step === "approving"
      ? "Approving…"
      : step === "buying"
        ? "Buying…"
        : step === "matching"
          ? "Matching…"
          : step === "signing"
            ? "Sign…"
            : step === "submitting"
              ? "Submit…"
              : step;

  const buyHelpTitle =
    "Price at or above the best ask: instant buy at that listing's USDC price. Below best ask: post a collection bid up to your amount. Click the order book to pre-fill price.";

  return {
    address,
    isConnected,
    price: floor.price,
    setPrice: floor.setPrice,
    priceTouchedRef: floor.priceTouchedRef,
    step,
    errorMsg,
    lastOutcome,
    postBidMatchHint,
    selectedFloorAskHash: floor.selectedFloorAskHash,
    setSelectedFloorAskHash: floor.setSelectedFloorAskHash,
    showAskChooserModal: floor.showAskChooserModal,
    setShowAskChooserModal: floor.setShowAskChooserModal,
    balanceUsdc,
    lowestAsk: floor.lowestAsk,
    lowestAskCandidates: floor.lowestAskCandidates,
    lowestAskUsdc: floor.lowestAskUsdc,
    floorMetaByTokenId: floor.floorMetaByTokenId,
    merkleLeafTokenIds,
    merkleLoading,
    merkleIsError,
    crossesBook: floor.crossesBook,
    enteredAboveBestAsk: floor.enteredAboveBestAsk,
    enteredUsdcLabel: floor.enteredUsdcLabel,
    priceOk: floor.priceOk,
    busy,
    submitDisabled,
    busyLabel,
    buyHelpTitle,
    walletSignerMissing,
    handleSubmit,
    runInstantPurchase,
  };
}
