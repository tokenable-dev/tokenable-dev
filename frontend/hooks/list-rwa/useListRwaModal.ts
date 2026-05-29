"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import { getOrderByHash } from "@/lib/core";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import { GAS_FALLBACK, gasWithCapFast, mapWalletError } from "@/lib/network";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteria/criteriaMatch";
import type { MatchWriteContractAsync } from "@/lib/seaport/fulfillment/runCriteriaMatch";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import { submitAskListingOrder } from "@/lib/seaport/orders/submitAskListing";
import { orderCollectionKey } from "@/lib/seaport/listing/listRwaModalUtils";
import {
  invalidateListingQueries,
  runPostListInstantMatch,
  type ListRwaInstantMatchDeps,
} from "@/lib/seaport/listing/listRwaInstantMatch";
import type {
  ListRwaModalProps,
  ListRwaModalStep,
  ListSuccessMeta,
} from "@/lib/seaport/listing/listRwaModalTypes";

export function useListRwaModal({
  tokenId,
  onClose,
  onMatchedSale,
  onListed,
  initialPriceUsdc,
  existingAskOrder,
  existingAskOrderHash,
  collectionKey,
  collectionBids,
  preferredBidOrderHash,
}: ListRwaModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient;
  const queryClient = useQueryClient();

  const { data: existingAskFetched } = useQuery({
    queryKey: ["orders", "detail", existingAskOrderHash ?? ""],
    queryFn: () => getOrderByHash(existingAskOrderHash!),
    enabled: Boolean(existingAskOrderHash?.trim()) && !existingAskOrder,
    staleTime: 15_000,
  });
  const resolvedExistingAsk = existingAskOrder ?? existingAskFetched ?? null;

  const [price, setPrice] = useState("");
  const [selectedBidHash, setSelectedBidHash] = useState<string | null>(null);
  const [step, setStep] = useState<ListRwaModalStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMeta, setSuccessMeta] = useState<ListSuccessMeta | null>(null);

  const topCollectionBid = useMemo(() => {
    if (!collectionBids?.length) return null;
    const rows = collectionBids.filter(
      (b) => b.status === "active" && isCriteriaCollectionBid(b),
    );
    if (!rows.length) return null;
    rows.sort((a, b) => {
      const da = bidUsdcAmount(a);
      const db = bidUsdcAmount(b);
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });
    const top = rows[0];
    const micros = bidUsdcAmount(top);
    let label: string;
    try {
      const n = Number(formatUnits(micros, 6));
      label = n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      label = String(micros);
    }
    return { micros, label, inputValue: formatUnits(micros, 6) };
  }, [collectionBids, address]);

  const askMicrosFromPrice = useMemo(() => {
    const t = price.trim();
    if (!t) return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return parseUnits(t, 6);
    } catch {
      return null;
    }
  }, [price]);

  const crossingBidsForInstantSale = useMemo(() => {
    if (askMicrosFromPrice == null || !collectionBids?.length) return [];
    const ck = collectionKey?.trim();
    const rows = collectionBids.filter((b) => {
      if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
      const bk = orderCollectionKey(b);
      if (ck && bk && bk.toLowerCase() !== ck.toLowerCase()) return false;
      return bidUsdcAmount(b) >= askMicrosFromPrice;
    });
    rows.sort((a, b) => {
      const da = bidUsdcAmount(a);
      const db = bidUsdcAmount(b);
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });
    return rows;
  }, [collectionBids, collectionKey, askMicrosFromPrice]);

  useEffect(() => {
    if (crossingBidsForInstantSale.length < 2) {
      setSelectedBidHash(null);
      return;
    }
    const hashes = crossingBidsForInstantSale.map((b) => String(b.orderHash));
    setSelectedBidHash((prev) =>
      prev && hashes.includes(prev) ? prev : hashes[0] ?? null,
    );
  }, [crossingBidsForInstantSale]);

  const preferredBidForMatch = useMemo(() => {
    if (crossingBidsForInstantSale.length >= 2 && selectedBidHash) return selectedBidHash;
    return preferredBidOrderHash ?? null;
  }, [crossingBidsForInstantSale.length, selectedBidHash, preferredBidOrderHash]);

  const isReplaceListing = useMemo(() => {
    if (!resolvedExistingAsk || !address) return false;
    if (resolvedExistingAsk.side !== "ask" || resolvedExistingAsk.status !== "active")
      return false;
    if (Number(normalizeDecimalTokenId(resolvedExistingAsk.tokenId)) !== Number(tokenId)) {
      return false;
    }
    return resolvedExistingAsk.offerer.toLowerCase() === address.toLowerCase();
  }, [resolvedExistingAsk, address, tokenId]);

  const currentAskDisplay = useMemo(() => {
    if (!isReplaceListing || !resolvedExistingAsk?.considerationAmount) return null;
    try {
      const micros = BigInt(resolvedExistingAsk.considerationAmount);
      const n = Number(formatUnits(micros, 6));
      if (!Number.isFinite(n)) return null;
      const label = n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return { micros, label, inputValue: formatUnits(micros, 6) };
    } catch {
      return null;
    }
  }, [isReplaceListing, resolvedExistingAsk?.considerationAmount]);

  useEffect(() => {
    if (step !== "success") return;
    const delayMs = successMeta?.matched
      ? 1800
      : successMeta?.hint
        ? 4200
        : 900;
    const id = window.setTimeout(() => onClose(), delayMs);
    return () => window.clearTimeout(id);
  }, [step, successMeta?.matched, successMeta?.hint, onClose]);

  useEffect(() => {
    if (initialPriceUsdc != null && initialPriceUsdc.trim() !== "") {
      setPrice(initialPriceUsdc.trim());
      return;
    }
    if (resolvedExistingAsk?.considerationAmount) {
      try {
        setPrice(formatUnits(BigInt(resolvedExistingAsk.considerationAmount), 6));
      } catch {
        setPrice("");
      }
      return;
    }
    setPrice("");
  }, [initialPriceUsdc, tokenId, resolvedExistingAsk?.orderHash]);

  const { writeContractAsync } = useWriteContract();

  const matchWrite = useMemo(
    () =>
      ((args: Parameters<MatchWriteContractAsync>[0]) =>
        writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0],
        )) as MatchWriteContractAsync,
    [writeContractAsync],
  );

  const instantMatchDeps = useMemo(
    (): ListRwaInstantMatchDeps => ({
      tokenId,
      address: address as Address | undefined,
      publicClient: publicClient ?? undefined,
      collectionKey,
      collectionBids,
      preferredBidForMatch,
      topCollectionBid: topCollectionBid ? { micros: topCollectionBid.micros } : null,
      resolvedExistingAsk,
      getWalletClient: () => walletClientRef.current ?? walletClient,
      writeContractAsync: matchWrite,
      queryClient,
    }),
    [
      tokenId,
      address,
      publicClient,
      collectionKey,
      collectionBids,
      preferredBidForMatch,
      topCollectionBid,
      resolvedExistingAsk,
      walletClient,
      matchWrite,
      queryClient,
    ],
  );

  async function handleList() {
    if (!address || !price || parseFloat(price) <= 0) return;
    if (!walletClient) {
      setErrorMsg("Wallet not connected. Please reconnect.");
      return;
    }
    if (!publicClient) {
      setErrorMsg("Network not ready. Try again.");
      return;
    }

    setErrorMsg("");
    setSuccessMeta(null);

    try {
      if (isReplaceListing && resolvedExistingAsk) {
        setStep("submitting");
        let created = await submitAskListingOrder({
          tokenId,
          priceUsdc: price.trim(),
          address: address as Address,
          publicClient,
          walletClient,
          writeContractAsync: writeContractAsync as Parameters<
            typeof submitAskListingOrder
          >[0]["writeContractAsync"],
          mode: "replace",
          oldOrderHash: resolvedExistingAsk.orderHash,
        });
        if (!orderCollectionKey(created) && created.orderHash) {
          try {
            const refreshed = await getOrderByHash(created.orderHash);
            if (orderCollectionKey(refreshed)) created = refreshed;
          } catch {
            /* keep created */
          }
        }

        const meta = await runPostListInstantMatch(instantMatchDeps, created, {
          onStartMatching: () => setStep("matching"),
        });
        if (meta.matched) {
          onMatchedSale?.();
        }

        onListed?.(tokenId);
        setSuccessMeta(meta);
        setStep("success");
        await invalidateListingQueries(instantMatchDeps, created);
        return;
      }

      const alreadyAll = await publicClient.readContract({
        address: TOKENABLE_RWA_ADDRESS,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "isApprovedForAll",
        args: [address, SEAPORT_ADDRESS],
      });
      if (!alreadyAll) {
        setStep("approving");
        const gasSetAll = await gasWithCapFast(
          publicClient,
          {
            address: TOKENABLE_RWA_ADDRESS,
            abi: TOKENABLE_RWA_APPROVE_ABI,
            functionName: "setApprovalForAll",
            args: [SEAPORT_ADDRESS, true],
            account: address,
          },
          GAS_FALLBACK.setApprovalForAll,
        );
        const setAllTx = await writeContractAsync({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_APPROVE_ABI,
          functionName: "setApprovalForAll",
          args: [SEAPORT_ADDRESS, true],
          chainId: sepolia.id,
          gas: gasSetAll,
        });
        await publicClient.waitForTransactionReceipt({ hash: setAllTx });
      }

      setStep("signing");
      const wc = walletClientRef.current ?? walletClient;
      if (!wc) {
        setErrorMsg("Wallet not connected. Please reconnect.");
        setStep("error");
        return;
      }

      let createdFinal = await submitAskListingOrder({
        tokenId,
        priceUsdc: price.trim(),
        address: address as Address,
        publicClient,
        walletClient: wc,
        writeContractAsync: writeContractAsync as Parameters<
          typeof submitAskListingOrder
        >[0]["writeContractAsync"],
        mode: "create",
      });
      if (!orderCollectionKey(createdFinal) && createdFinal.orderHash) {
        try {
          const refreshed = await getOrderByHash(createdFinal.orderHash);
          if (orderCollectionKey(refreshed)) createdFinal = refreshed;
        } catch {
          /* keep created */
        }
      }

      const meta = await runPostListInstantMatch(instantMatchDeps, createdFinal, {
        onStartMatching: () => setStep("matching"),
      });
      if (meta.matched) {
        onMatchedSale?.();
      }

      onListed?.(tokenId);
      setSuccessMeta(meta);
      setStep("success");

      await invalidateListingQueries(instantMatchDeps, createdFinal);
    } catch (err: unknown) {
      setErrorMsg(mapWalletError(err).message);
      setStep("error");
    }
  }

  const isProcessing =
    step === "approving" ||
    step === "signing" ||
    step === "submitting" ||
    step === "matching";

  return {
    price,
    setPrice,
    step,
    errorMsg,
    successMeta,
    isReplaceListing,
    currentAskDisplay,
    crossingBidsForInstantSale,
    selectedBidHash,
    setSelectedBidHash,
    isProcessing,
    handleList,
  };
}
