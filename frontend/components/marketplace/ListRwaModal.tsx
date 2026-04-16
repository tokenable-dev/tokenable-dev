"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { formatUnits, type Address } from "viem";
import type { Order } from "@/lib/api";
import { sepolia } from "@/config/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import {
  getMarketplaceCollectionDetail,
  getMerkleEligibleTokenIds,
  getOrderByHash,
} from "@/lib/api";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";
import { askGrossUsdcMicros, bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";
import { bidMerkleRootMatchesCollection } from "@/lib/seaport/collectionCriteriaRoot";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";
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
  onListed?: (tokenId: number) => void;
  /** 풀 최대가로 재리스트할 때 가격 필드에 미리 채움 (예: "3.00") */
  initialPriceUsdc?: string | null;
  /** Active ask to replace (e.g. lower price) — replace-listing, then instant collection-bid match. */
  existingAskOrder?: Order | null;
  /** With `collectionBids`, after you list we automatically run `matchAdvancedOrders` when your price crosses an eligible collection bid (no separate “instant match” step). */
  collectionKey?: string | null;
  collectionBids?: Order[];
}

export function ListRwaModal({
  tokenId,
  onClose,
  onListed,
  initialPriceUsdc,
  existingAskOrder,
  collectionKey,
  collectionBids,
}: ListRwaModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient;
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
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
    /** Modal is opened in a collection context — use prop even if API row omitted `collectionKey` (avoids skipping match entirely). */
    if (!key && collectionKey != null && String(collectionKey).trim() !== "") {
      key = String(collectionKey).trim();
    }
    // Match uses `writeContractAsync`; do not require `useWalletClient` here (it can be undefined briefly after awaits).
    if (!key || !address || !publicClient) {
      return { matched: false };
    }

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

    const propBids = collectionBids ?? [];
    const askAm = askGrossUsdcMicros(created);

    let bids: Order[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
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

      if (attempt < 7) {
        await new Promise((r) => setTimeout(r, 150 * (attempt + 1)));
      }
    }

    if (!bids.length) {
      return { matched: false };
    }

    const tidBn = BigInt(normalizeDecimalTokenId(tokenId));
    let merkleTokenIds: string[] | null = null;
    const merkleAttempts = 5;
    const merkleDelayMs = 200;
    for (let i = 0; i < merkleAttempts; i++) {
      const { tokenIds } = await getMerkleEligibleTokenIds(key, { bypassCache: true });
      const ids = tokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
      if (!ids.length || !ids.some((id) => id === tidBn)) {
        if (i < merkleAttempts - 1) {
          await new Promise((r) => setTimeout(r, merkleDelayMs));
        }
        continue;
      }
      merkleTokenIds = tokenIds;
      break;
    }
    if (!merkleTokenIds?.length) {
      return {
        matched: false,
        hint:
          "Your listing is not in the collection Merkle set yet (indexing delay). Wait a few seconds and try again from the collection page.",
      };
    }
    const currentRoot = new SeaportMerkleTree(
      merkleTokenIds.map((x) => BigInt(normalizeDecimalTokenId(x))),
    ).getHexRoot();

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
      return {
        matched: false,
        hint: hasCriteriaBids
          ? "There are collection bids, but none at or above your list price. Try the bid price or lower."
          : undefined,
      };
    }

    const candidates = pricedBids
      .filter((b) => bidMerkleRootMatchesCollection(b, currentRoot))
      .sort((a, b) => (bidUsdcAmount(a) > bidUsdcAmount(b) ? -1 : 1));

    if (candidates.length === 0) {
      return {
        matched: false,
        hint:
          "No bid’s Merkle root matches the server’s current leaf set. Common causes: (1) the bid was placed before a new RWA in this pool was minted — the buyer must cancel and re-place the bid; (2) a flaky IPFS/metadata scan — try listing again in a few seconds; (3) env drift between bid and list (wrong collection).",
      };
    }

    const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
      writeContractAsync(
        args as Parameters<typeof writeContractAsync>[0],
      )) as MatchWriteContractAsync;

    let lastErr = "";
    let listing: Order = created;

    for (const bid of candidates) {
      try {
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
        lastErr = mapMatchError(e);
      }
    }

    const merkleHint = lastErr.toLowerCase().includes("merkle")
      ? " If this persists, the buyer may need to cancel and re-place their collection bid for the updated listing set."
      : "";

    return {
      matched: false,
      hint: lastErr
        ? `${lastErr}${merkleHint}`
        : "Could not fill a collection bid automatically.",
    };
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
        const meta = await tryMatchAfterListing(created);

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
      const meta = await tryMatchAfterListing(createdFinal);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors text-lg"
        >
          ✕
        </button>

        {step === "success" ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">{successMeta?.matched ? "✓" : "🎉"}</div>
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
              className="mt-5 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-1">
              {isReplaceListing ? `Update listing · #${tokenId}` : `List Asset #${tokenId} for Sale`}
            </h2>
            <p className="text-sm text-gray-500 mb-3">
              {isReplaceListing
                ? "Enter the new USDC price and confirm."
                : "Set a price in USDC. Your asset will be listed via Seaport."}
            </p>

            {currentAskDisplay ? (
              <div className="mb-3 rounded-lg border border-slate-600/50 bg-slate-800/50 px-3 py-2.5">
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

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1.5">
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
                  className="w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  USDC
                </span>
              </div>
              {price && parseFloat(price) > 0 && feePercent() > 0 && (
                <div className="mt-2 space-y-1 text-[11px]">
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

            <div className="flex gap-2 mb-4">
              {stepLabels.map(({ label, active }) => (
                <div
                  key={label}
                  className={`flex-1 text-center text-xs py-1.5 rounded-lg ${
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-400 break-all">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={() => void handleList()}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="w-full py-2.5 bg-gradient-to-r from-mint to-mint-dim hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-semibold rounded-lg transition-all"
            >
              {isProcessing
                ? "Processing..."
                : isReplaceListing
                  ? "Confirm"
                  : "List for sale"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
