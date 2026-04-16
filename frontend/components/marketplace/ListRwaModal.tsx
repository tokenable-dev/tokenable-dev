"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import type { Order } from "@/lib/api";
import { sepolia } from "@/config/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import { getMarketplaceCollectionDetail, getOrderByHash } from "@/lib/api";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";
import { askGrossUsdcMicros, bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";
import {
  bidMerkleRootMatchesCollection,
  fetchMerkleSnapshotForMatch,
} from "@/lib/seaport/collectionCriteriaRoot";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";
import {
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "@/lib/seaport/seaportOrderTime";
import { submitAskListingOrder } from "@/lib/seaport/submitAskListing";
import { feePercent } from "@/lib/seaport/platformFee";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

function orderCollectionKey(o: Order | null | undefined): string {
  if (!o) return "";
  const any = o as Order & { collection_key?: string };
  const k = o.collectionKey ?? any.collection_key;
  return k != null ? String(k).trim() : "";
}

/**
 * Modal props sometimes omit `collectionKey` (e.g. My Assets), but the saved ask row has it —
 * use API fields so matchAdvancedOrders still runs after replace/create.
 */
function shortBidder(addr: string) {
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function resolveMatchCollectionKey(
  created: Order,
  propKey: string | null | undefined,
  existingAsk?: Order | null,
  bids?: Order[],
): string | undefined {
  const a = orderCollectionKey(created);
  const b = propKey != null ? propKey.trim() : "";
  const c = orderCollectionKey(existingAsk ?? undefined);
  let fromBid = "";
  for (const x of bids ?? []) {
    if (x.status === "active" && isCriteriaCollectionBid(x)) {
      const k = orderCollectionKey(x);
      if (k) {
        fromBid = k;
        break;
      }
    }
  }
  return a || b || c || fromBid || undefined;
}

type Step =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "matching"
  | "success"
  | "error";

interface ListSuccessMeta {
  matched: boolean;
  hint?: string;
}

interface ListRwaModalProps {
  tokenId: number;
  onClose: () => void;
  /** Listing immediately matched a collection bid (`matchAdvancedOrders` succeeded). */
  onMatchedSale?: () => void;
  onListed?: (tokenId: number) => void;
  /** 풀 최대가로 재리스트할 때 가격 필드에 미리 채움 (예: "3.00") */
  initialPriceUsdc?: string | null;
  /** Active ask to replace (e.g. lower price) — replace-listing, then instant collection-bid match. */
  existingAskOrder?: Order | null;
  /** With `collectionBids`, after you list we automatically run `matchAdvancedOrders` when your price crosses an eligible collection bid (no separate “instant match” step). */
  collectionKey?: string | null;
  collectionBids?: Order[];
  /** When set (e.g. order book bid row selected), try this bid first for `matchAdvancedOrders`. */
  preferredBidOrderHash?: string | null;
}

export function ListRwaModal({
  tokenId,
  onClose,
  onMatchedSale,
  onListed,
  initialPriceUsdc,
  existingAskOrder,
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

  const [price, setPrice] = useState("");
  /** When several collection bids equal the list price exactly, seller picks which to try first. */
  const [tieBreakBidHash, setTieBreakBidHash] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMeta, setSuccessMeta] = useState<ListSuccessMeta | null>(null);

  /** Highest active criteria bid (including your own) — same wallet can bid + list; instant match still runs on-chain. */
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

  const bidsAtExactListPrice = useMemo(() => {
    if (askMicrosFromPrice == null || !collectionBids?.length) return [];
    const ck = collectionKey?.trim();
    return collectionBids.filter((b) => {
      if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
      const bk = orderCollectionKey(b);
      if (ck && bk && bk.toLowerCase() !== ck.toLowerCase()) return false;
      return bidUsdcAmount(b) === askMicrosFromPrice;
    });
  }, [collectionBids, collectionKey, askMicrosFromPrice]);

  useEffect(() => {
    if (bidsAtExactListPrice.length < 2) {
      setTieBreakBidHash(null);
      return;
    }
    const hashes = bidsAtExactListPrice.map((b) => String(b.orderHash));
    setTieBreakBidHash((prev) =>
      prev && hashes.includes(prev) ? prev : hashes[0] ?? null,
    );
  }, [bidsAtExactListPrice]);

  const preferredBidForMatch = useMemo(() => {
    if (bidsAtExactListPrice.length >= 2 && tieBreakBidHash) return tieBreakBidHash;
    return preferredBidOrderHash ?? null;
  }, [bidsAtExactListPrice.length, tieBreakBidHash, preferredBidOrderHash]);

  const isReplaceListing = useMemo(() => {
    if (!existingAskOrder || !address) return false;
    if (existingAskOrder.side !== "ask" || existingAskOrder.status !== "active") return false;
    if (Number(normalizeDecimalTokenId(existingAskOrder.tokenId)) !== Number(tokenId)) {
      return false;
    }
    return existingAskOrder.offerer.toLowerCase() === address.toLowerCase();
  }, [existingAskOrder, address, tokenId]);

  /** Live book price before this edit — drives “$5 ask vs $4 bid” UX. */
  const currentAskDisplay = useMemo(() => {
    if (!isReplaceListing || !existingAskOrder?.considerationAmount) return null;
    try {
      const micros = BigInt(existingAskOrder.considerationAmount);
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
  }, [isReplaceListing, existingAskOrder?.considerationAmount]);

  useEffect(() => {
    if (initialPriceUsdc != null && initialPriceUsdc.trim() !== "") {
      setPrice(initialPriceUsdc.trim());
      return;
    }
    if (existingAskOrder?.considerationAmount) {
      try {
        setPrice(formatUnits(BigInt(existingAskOrder.considerationAmount), 6));
      } catch {
        setPrice("");
      }
      return;
    }
    setPrice("");
  }, [initialPriceUsdc, tokenId, existingAskOrder?.orderHash]);

  const { writeContractAsync } = useWriteContract();

  function mergeBidsByOrderHash(api: Order[], hints: Order[]): Order[] {
    const m = new Map<string, Order>();
    for (const b of api) {
      if (b?.orderHash) m.set(b.orderHash, b);
    }
    for (const b of hints) {
      if (b?.orderHash && !m.has(b.orderHash)) m.set(b.orderHash, b);
    }
    return [...m.values()];
  }

  /**
   * Highest USDC bid first. If `preferred` is set, it only moves to the front **within the same
   * bid amount** (tie-break for multiple buyers at one price) — never before a strictly higher bid.
   */
  function orderMatchCandidates(merkleOk: Order[], preferred?: string | null): Order[] {
    const byPriceDesc = (a: Order, b: Order) => {
      const da = bidUsdcAmount(a);
      const db = bidUsdcAmount(b);
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    };
    const sorted = [...merkleOk].sort(byPriceDesc);
    const p = preferred?.trim();
    if (!p) return sorted;

    const out: Order[] = [];
    let i = 0;
    while (i < sorted.length) {
      const tierPrice = bidUsdcAmount(sorted[i]!);
      const tier: Order[] = [];
      while (i < sorted.length && bidUsdcAmount(sorted[i]!) === tierPrice) {
        tier.push(sorted[i]!);
        i++;
      }
      const prefIdx = tier.findIndex((b) => b.orderHash === p);
      if (prefIdx > 0) {
        const pref = tier[prefIdx]!;
        out.push(pref, ...tier.filter((_, j) => j !== prefIdx));
      } else {
        out.push(...tier);
      }
    }
    return out;
  }

  /**
   * List-then-instant-match: refetch bids + Merkle with retries (indexing lag), optional multi-round,
   * and preferred bid hash (from order book) first.
   */
  async function tryMatchAfterListing(created: Order): Promise<ListSuccessMeta> {
    let key = resolveMatchCollectionKey(
      created,
      collectionKey,
      existingAskOrder,
      collectionBids,
    );
    if (!key && created.orderHash) {
      try {
        const refreshed = await getOrderByHash(created.orderHash);
        key = resolveMatchCollectionKey(
          refreshed,
          collectionKey,
          existingAskOrder,
          collectionBids,
        );
      } catch {
        /* keep */
      }
    }
    if (!key && collectionKey != null && String(collectionKey).trim() !== "") {
      key = String(collectionKey).trim();
    }
    if (!key || !address || !publicClient) {
      return { matched: false };
    }

    const propBids = collectionBids ?? [];
    const askAm = askGrossUsdcMicros(created);
    const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
      writeContractAsync(
        args as Parameters<typeof writeContractAsync>[0],
      )) as MatchWriteContractAsync;

    const maxMatchRounds = 3;
    let lastMeta: ListSuccessMeta = { matched: false };

    for (let round = 0; round < maxMatchRounds; round++) {
      if (round > 0) {
        await new Promise((r) => setTimeout(r, 380 * round));
        await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
        await queryClient.invalidateQueries({ queryKey: ["merkle-set", key] });
        await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
      }

      let bids: Order[] = [];
      const detailAttempts = 12;
      for (let attempt = 0; attempt < detailAttempts; attempt++) {
        const detail = await getMarketplaceCollectionDetail(key, {
          bypassCache: true,
        }).catch(() => null);
        const fromApi = detail?.collectionBids ?? [];
        bids = mergeBidsByOrderHash(fromApi, propBids);

        if (bids.length > 0) {
          const hasCrossing = bids.some((b) => {
            if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
            const bk = orderCollectionKey(b);
            if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
            return bidUsdcAmount(b) >= askAm;
          });
          if (hasCrossing) break;
        }

        if (attempt < detailAttempts - 1) {
          await new Promise((r) => setTimeout(r, 120 + attempt * 35));
        }
      }

      if (!bids.length) {
        lastMeta = { matched: false };
        continue;
      }

      const merkleSnap = await fetchMerkleSnapshotForMatch(key, {
        expectTokenId: tokenId,
        maxAttempts: 14,
        delayMs: 200,
        bypassMerkleCache: true,
      });

      if (!merkleSnap?.tokenIds.length) {
        lastMeta = {
          matched: false,
          hint:
            "Your listing is not in the collection Merkle set yet (indexing delay). Retrying… If this persists, open this collection again in a few seconds.",
        };
        continue;
      }

      const { tokenIds: merkleTokenIds, rootHex: currentRoot } = merkleSnap;

      const pricedBids = bids.filter((b) => {
        if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
        const bk = orderCollectionKey(b);
        if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
        return bidUsdcAmount(b) >= askAm;
      });

      if (pricedBids.length === 0) {
        const hasCriteriaBids = bids.some(
          (b) => b.status === "active" && isCriteriaCollectionBid(b),
        );
        lastMeta = {
          matched: false,
          hint: hasCriteriaBids
            ? "There are collection bids, but none at or above your list price. Try the bid price or lower."
            : undefined,
        };
        if (hasCriteriaBids) break;
        continue;
      }

      const merkleOk = pricedBids.filter((b) =>
        bidMerkleRootMatchesCollection(b, currentRoot),
      );
      const candidates = orderMatchCandidates(merkleOk, preferredBidForMatch);

      if (candidates.length === 0) {
        lastMeta = {
          matched: false,
          hint:
            "No bid’s Merkle root matches the server’s current leaf set. The buyer must cancel and re-place their collection bid after pool updates, then list again (or use Match on the token page).",
        };
        continue;
      }

      let lastErr = "";
      let listing: Order = created;

      for (const bid of candidates) {
        try {
          const chainNow = await getChainTimestampSec(publicClient);
          if (!isSeaportOrderActiveAt(listing, chainNow)) {
            const wc = walletClientRef.current;
            if (!wc) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then try again so the listing can be refreshed.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId,
              priceUsdc: formatUnits(askGrossUsdcMicros(listing), 6),
              address: address as Address,
              publicClient,
              walletClient: wc,
              writeContractAsync: writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }
          if (askGrossUsdcMicros(listing) > bidUsdcAmount(bid)) {
            const wc = walletClientRef.current;
            if (!wc) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then change the list price to the bid or try again.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId,
              priceUsdc: formatUnits(bidUsdcAmount(bid), 6),
              address: address as Address,
              publicClient,
              walletClient: wc,
              writeContractAsync: writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }

          await runCriteriaMatch({
            address: address as Address,
            publicClient,
            writeContractAsync: matchWrite,
            bid,
            listing,
            tokenId,
            collectionKey: key,
            merkleTokenIds,
          });

          return { matched: true };
        } catch (e: unknown) {
          lastErr = mapMatchError(e, { bidOfferer: bid.offerer });
        }
      }

      const merkleHint = lastErr.toLowerCase().includes("merkle")
        ? " If this persists, the buyer may need to cancel and re-place their collection bid for the updated listing set."
        : "";

      lastMeta = {
        matched: false,
        hint: lastErr
          ? `${lastErr}${merkleHint}`
          : "Could not fill a collection bid automatically.",
      };
    }

    return lastMeta;
  }

  async function invalidateListingQueries(created: Order) {
    await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    const colKey =
      orderCollectionKey(created) ||
      (collectionKey != null ? collectionKey.trim() : "") ||
      orderCollectionKey(existingAskOrder);
    if (colKey) {
      await queryClient.invalidateQueries({ queryKey: ["merkle-set", colKey] });
    }
    if (address) {
      await queryClient.invalidateQueries({ queryKey: ["my-rwa-ids", address] });
    }
  }

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
      if (isReplaceListing && existingAskOrder) {
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
          oldOrderHash: existingAskOrder.orderHash,
        });
        if (!orderCollectionKey(created) && created.orderHash) {
          try {
            const refreshed = await getOrderByHash(created.orderHash);
            if (orderCollectionKey(refreshed)) created = refreshed;
          } catch {
            /* keep created */
          }
        }

        setStep("matching");
        {
          const ck = collectionKey?.trim();
          if (ck) {
            await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", ck] });
            await queryClient.invalidateQueries({ queryKey: ["merkle-set", ck] });
            await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
          }
        }
        const meta = await tryMatchAfterListing(created);
        if (meta.matched) {
          onMatchedSale?.();
        }

        onListed?.(tokenId);
        setSuccessMeta(meta);
        setStep("success");
        await invalidateListingQueries(created);
        return;
      }

      // ── Step 1: OpenSea-style setApprovalForAll(Seaport, true) — 한 번이면 전 토큰 리스팅 가능
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

      // Sign + POST: same code path as price replace (`submitAskListingOrder`) so counter / startTime / salt
      // are read together after any approval wait — avoids a mismatched first-listing signature vs replace.
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

      setStep("matching");
      {
        const ck = collectionKey?.trim();
        if (ck) {
          await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", ck] });
          await queryClient.invalidateQueries({ queryKey: ["merkle-set", ck] });
          await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
        }
      }
      const meta = await tryMatchAfterListing(createdFinal);
      if (meta.matched) {
        onMatchedSale?.();
      }

      onListed?.(tokenId);
      setSuccessMeta(meta);
      setStep("success");

      await invalidateListingQueries(createdFinal);
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

  const showMatchStep = Boolean(
    collectionKey?.trim() ||
      orderCollectionKey(existingAskOrder) ||
      topCollectionBid != null,
  );
  const stepLabels: { label: string; active: boolean }[] = [
    { label: "1. Approve marketplace", active: step === "approving" },
    { label: "2. Sign Order", active: step === "signing" },
    { label: "3. Submitting", active: step === "submitting" },
    ...(showMatchStep ? [{ label: "4. Match bid", active: step === "matching" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-[min(100%,26rem)] flex-col rounded-2xl border border-gray-700 bg-gray-900 px-7 py-8 sm:px-9 sm:py-10">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-lg text-gray-500 transition-colors hover:text-white sm:right-5 sm:top-5"
        >
          ✕
        </button>

        {step === "success" ? (
          <div className="flex flex-col px-0 pb-1 pt-2 text-center sm:pt-3 sm:pr-2">
            <div className="mb-3 text-4xl">{successMeta?.matched ? "✓" : "🎉"}</div>
            <h3 className="text-lg font-bold text-white mb-1">
              {successMeta?.matched
                ? "Matched a collection bid"
                : isReplaceListing
                  ? "Listing updated"
                  : "Listed successfully"}
            </h3>
            <p className="text-sm text-gray-400">
              {successMeta?.matched
                ? `Asset #${tokenId} sold via matchAdvancedOrders (check your wallet for USDC).`
                : isReplaceListing
                  ? `Asset #${tokenId} ask is now ${price} USDC.`
                  : `Asset #${tokenId} is now listed for ${price} USDC`}
            </p>
            {!successMeta?.matched && feePercent() > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {feePercent()}% platform fee included · You&apos;ll receive{" "}
                {(parseFloat(price) * (1 - feePercent() / 100)).toFixed(2)} USDC on sale
              </p>
            )}
            {!successMeta?.matched && (
              <p className="text-xs text-gray-600 mt-2">Listing valid for 30 days</p>
            )}
            {!successMeta?.matched && successMeta?.hint ? (
              <p className="text-[11px] text-amber-200/85 mt-3 text-left leading-relaxed rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
                A collection bid at or above your price was found, but it could not be filled
                automatically. {successMeta.hint}
              </p>
            ) : null}
            <button
              onClick={onClose}
              className="mt-8 w-full rounded-xl bg-gray-800 py-3 text-sm text-white transition-colors hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-2 pr-10 sm:pr-12">
            <div>
              <h2 className="text-xl font-bold leading-snug text-white sm:text-[1.35rem]">
                {isReplaceListing ? `Update listing · #${tokenId}` : `List Asset #${tokenId} for Sale`}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {isReplaceListing
                  ? "Enter the new USDC price and confirm."
                  : "Set a price in USDC. Your asset will be listed via Seaport."}
              </p>
            </div>

            {currentAskDisplay ? (
              <div className="rounded-xl border border-slate-600/50 bg-slate-800/50 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Current ask (on the book)
                </p>
                <p className="text-base font-semibold tabular-nums text-white mt-1">
                  <span className="text-slate-400 text-sm font-normal mr-0.5">$</span>
                  {currentAskDisplay.label}
                  <span className="text-slate-500 font-normal text-xs ml-1">USDC</span>
                </p>
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm text-gray-400">
                {isReplaceListing ? "New price (USDC)" : "Price (USDC)"}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isProcessing}
                  className="w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 pr-16 text-base text-white outline-none placeholder:text-gray-600 focus:border-mint"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  USDC
                </span>
              </div>
              {price && parseFloat(price) > 0 && feePercent() > 0 && (
                <div className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-gray-500">
                    <span>Platform fee ({feePercent()}%)</span>
                    <span className="font-mono text-gray-400">
                      {(parseFloat(price) * feePercent() / 100).toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>You receive</span>
                    <span className="font-mono text-white">
                      {(parseFloat(price) * (1 - feePercent() / 100)).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              )}
            </div>

            {bidsAtExactListPrice.length >= 2 && tieBreakBidHash ? (
              <div className="rounded-xl border border-mint-deep/35 bg-mint/[0.06] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-mint/90">
                  Same-price bids
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
                  {bidsAtExactListPrice.length} collection bids match this exact price. Choose
                  which buyer to match first (if that fill fails, others are tried).
                </p>
                <ul className="mt-2.5 space-y-2">
                  {bidsAtExactListPrice.map((b) => {
                    const id = String(b.orderHash);
                    const selected = tieBreakBidHash === id;
                    return (
                      <li key={id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                            selected
                              ? "border-mint/50 bg-mint/[0.08]"
                              : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                          }`}
                        >
                          <input
                            type="radio"
                            name="tie-break-bid"
                            className="accent-mint"
                            checked={selected}
                            disabled={isProcessing}
                            onChange={() => setTieBreakBidHash(id)}
                          />
                          <span className="text-[12px] text-gray-200">
                            Buyer{" "}
                            <span className="font-mono text-mint/90">
                              {shortBidder(b.offerer)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {stepLabels.map(({ label, active }) => (
                <div
                  key={label}
                  className={`rounded-xl px-2 py-2.5 text-center text-[11px] leading-tight sm:text-xs ${
                    active
                      ? "bg-mint-dim text-mint-ink animate-pulse"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {step === "error" && errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs text-red-400 break-all">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={() => void handleList()}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-mint to-mint-dim py-3.5 text-sm font-semibold text-mint-ink transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing
                ? "Processing..."
                : isReplaceListing
                  ? "Confirm"
                  : "List for sale"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
