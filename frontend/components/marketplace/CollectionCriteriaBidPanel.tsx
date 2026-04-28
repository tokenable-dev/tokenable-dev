"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatUnits, hexToBigInt, maxUint256, parseUnits, type Address } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import {
  createOrder,
  getMerkleEligibleTokenIds,
  postRwaMetadataBatch,
  type Order,
} from "@/lib/core";
import { GAS_FALLBACK, gasWithCapFast, mapWalletError } from "@/lib/network";
import { assertMerkleRootBytes32 } from "@/lib/seaport/eip712Uint";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { feePercent } from "@/lib/seaport/platformFee";
import { fulfillAskListingOrder } from "@/lib/seaport/fulfillAskListing";
import type { MatchWriteContractAsync } from "@/lib/seaport/runCriteriaMatch";
import { getChainTimestampSec } from "@/lib/seaport/seaportOrderTime";
import { tryMatchCriteriaBidAgainstBook } from "@/lib/seaport/tryMatchCriteriaBidAgainstBook";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;
const ITEM_ERC20 = 1;
const ITEM_CRITERIA721 = 4;

type Step =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "matching"
  | "buying"
  | "success"
  | "error";

function isListingAskRow(o: Order): boolean {
  const s = String(o.side ?? "ask").toLowerCase();
  return s !== "bid";
}

/** USDC micros (6 dp) from listing row — safe for API string/number JSON. */
function askPriceMicros(o: Order): bigint {
  try {
    const raw = o.considerationAmount;
    const s = typeof raw === "bigint" ? String(raw) : String(raw ?? "").trim();
    if (!s) return BigInt(0);
    return BigInt(s);
  } catch {
    return BigInt(0);
  }
}

/**
 * Cheapest active listing on the book (any offerer). Same wallet can fulfill its own ask
 * so 11 USDC list + 11 USDC buy uses instant `fulfillOrder`; below best ask → collection bid.
 */
function pickLowestActiveAsk(activeAsks: Order[]): Order | null {
  const cands = activeAsks.filter((o) => o.status === "active" && isListingAskRow(o));
  if (cands.length === 0) return null;
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  return cands[0];
}

/** All active asks at the current floor price, sorted for deterministic picker UI. */
function pickLowestActiveAskCandidates(activeAsks: Order[]): Order[] {
  const cands = activeAsks.filter((o) => o.status === "active" && isListingAskRow(o));
  if (cands.length === 0) return [];
  cands.sort((a, b) => {
    const pa = askPriceMicros(a);
    const pb = askPriceMicros(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const floor = askPriceMicros(cands[0]!);
  return cands.filter((o) => askPriceMicros(o) === floor);
}

function formatUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return amountStr;
  }
}

export function CollectionCriteriaBidPanel({
  collectionKey,
  activeAsks = [],
  /** Prefer parent (Zustand) address so this panel matches OrderBook / rest of page. */
  connectedAddress,
  onPlaced,
  /** Listing price (USDC) actually paid on a successful instant buy — for live last-print UI without polling. */
  onInstantBuyFillUsdc,
  onOpenSellModal,
  presetPriceFromBook,
  /** Lighter chrome when nested in the exchange column (avoids cramped card-in-card). */
  variant = "card",
  onPurchaseFilled,
}: {
  collectionKey: string;
  activeAsks?: Order[];
  connectedAddress?: `0x${string}` | string | null;
  onPlaced?: (order: Order) => void;
  onInstantBuyFillUsdc?: (usdc: number) => void;
  onOpenSellModal?: () => void;
  /** Synced when user clicks a bid row on the order book (criteria bid price). */
  presetPriceFromBook?: string | null;
  variant?: "card" | "embedded";
  /** Instant buy or bid+match filled — parent may show a celebration modal. */
  onPurchaseFilled?: () => void;
}) {
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

  const [price, setPrice] = useState("");
  const priceTouchedRef = useRef(false);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastOutcome, setLastOutcome] = useState<"instant" | "bid" | null>(null);
  /** When bid saved but auto matchAdvancedOrders didn’t run — explain without failing the flow. */
  const [postBidMatchHint, setPostBidMatchHint] = useState<string | null>(null);
  /** Same-price floor asks: let buyer choose token before instant purchase. */
  const [selectedFloorAskHash, setSelectedFloorAskHash] = useState<string | null>(null);
  const [showAskChooserModal, setShowAskChooserModal] = useState(false);

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

  const lowestAskCandidates = useMemo(
    () => pickLowestActiveAskCandidates(activeAsks),
    [activeAsks],
  );
  const lowestAsk = useMemo(() => {
    if (lowestAskCandidates.length === 0) return null;
    if (!selectedFloorAskHash) return lowestAskCandidates[0]!;
    return (
      lowestAskCandidates.find((o) => o.orderHash === selectedFloorAskHash) ??
      lowestAskCandidates[0]!
    );
  }, [lowestAskCandidates, selectedFloorAskHash]);

  useEffect(() => {
    if (lowestAskCandidates.length < 2) {
      setSelectedFloorAskHash(null);
      return;
    }
    const hashes = lowestAskCandidates.map((o) => o.orderHash);
    setSelectedFloorAskHash((prev) => (prev && hashes.includes(prev) ? prev : hashes[0]!));
  }, [lowestAskCandidates]);

  const floorAskTokenIds = useMemo(
    () => lowestAskCandidates.map((o) => Number(o.tokenId)).filter((id) => Number.isFinite(id)),
    [lowestAskCandidates],
  );

  const { data: floorAskMetaPack } = useQuery({
    queryKey: [
      "floor-ask-metadata",
      collectionKey,
      [...floorAskTokenIds].sort((a, b) => a - b).join(","),
    ],
    queryFn: () => postRwaMetadataBatch({ tokenIds: floorAskTokenIds }),
    enabled: showAskChooserModal && floorAskTokenIds.length > 0,
    staleTime: 60_000,
  });

  const floorMetaByTokenId = useMemo(() => {
    const m = new Map<number, { name?: string; imageUrl: string | null }>();
    for (const it of floorAskMetaPack?.items ?? []) {
      const name =
        typeof it.metadata?.name === "string" && it.metadata.name.trim().length > 0
          ? it.metadata.name.trim()
          : undefined;
      m.set(it.tokenId, { name, imageUrl: it.imageUrl ?? null });
    }
    return m;
  }, [floorAskMetaPack]);

  const lowestAskUsdc = lowestAsk ? formatUsdc6(String(askPriceMicros(lowestAsk))) : null;

  useEffect(() => {
    if (presetPriceFromBook != null && presetPriceFromBook.trim() !== "") {
      setPrice(presetPriceFromBook);
      priceTouchedRef.current = false;
    }
  }, [presetPriceFromBook]);

  /** Prefill so Buy isn’t stuck disabled on empty input (common after page load). */
  useEffect(() => {
    if (priceTouchedRef.current || !lowestAsk || presetPriceFromBook != null) return;
    try {
      const s = formatUnits(askPriceMicros(lowestAsk), 6);
      const n = parseFloat(s);
      setPrice(Number.isFinite(n) ? String(n) : s);
    } catch {
      /* ignore */
    }
  }, [lowestAsk, presetPriceFromBook]);


  const priceInUnits = useMemo(() => {
    try {
      const trimmed = price.trim();
      if (!trimmed) return null;
      const n = parseFloat(trimmed);
      if (!Number.isFinite(n) || n <= 0) return null;
      return parseUnits(trimmed, 6);
    } catch {
      return null;
    }
  }, [price]);

  /** Like a limit order crossing the book: price ≥ best ask → fill cheapest listing (pay listing price on-chain). */
  const crossesBook = useMemo(() => {
    if (!lowestAsk || priceInUnits == null) return false;
    return priceInUnits >= askPriceMicros(lowestAsk);
  }, [lowestAsk, priceInUnits]);

  /** 입력이 최저가보다 크면 “9 넣었는데 7만 청구”를 한눈에 알 수 있게 한다. */
  const enteredAboveBestAsk = useMemo(() => {
    if (!lowestAsk || priceInUnits == null || !crossesBook) return false;
    return priceInUnits > askPriceMicros(lowestAsk);
  }, [lowestAsk, priceInUnits, crossesBook]);

  const enteredUsdcLabel = useMemo(() => {
    if (priceInUnits == null) return null;
    try {
      const n = Number(formatUnits(priceInUnits, 6));
      if (!Number.isFinite(n)) return null;
      return n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  }, [priceInUnits]);

  const canPlaceCriteriaBid =
    merkleLeafTokenIds.length > 0 && counter !== undefined && !merkleLoading && !merkleIsError;

  const priceOk = priceInUnits != null;

  async function invalidateAfterTrade() {
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
    await queryClient.invalidateQueries({ queryKey: ["rwa-tokens"] });
    await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
    });
  }

  async function runInstantPurchase(ask: Order) {
    if (!address || !publicClient) return;
    setStep("buying");
    setErrorMsg("");
    try {
      await fulfillAskListingOrder({
        ask,
        address,
        publicClient,
        writeContractAsync: writeContractAsync as Parameters<
          typeof fulfillAskListingOrder
        >[0]["writeContractAsync"],
        chainId: sepolia.id,
      });
      setLastOutcome("instant");
      setStep("success");
      try {
        const paid = Number(formatUnits(askPriceMicros(ask), 6));
        if (Number.isFinite(paid) && paid > 0) {
          onInstantBuyFillUsdc?.(paid);
        }
      } catch {
        /* ignore */
      }
      onPlaced?.(ask);
      onPurchaseFilled?.();
      void invalidateAfterTrade();
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(mapWalletError(e).message);
    }
  }

  async function handleSubmit() {
    if (!publicClient) {
      setErrorMsg("Network not ready. Refresh or switch to Sepolia.");
      return;
    }
    if (!address) {
      setErrorMsg("Connect your wallet.");
      return;
    }
    if (!priceOk || priceInUnits == null) {
      setErrorMsg("Enter a valid USDC amount.");
      return;
    }

    const lowest = lowestAsk ?? pickLowestActiveAsk(activeAsks);
    const willFill = lowest != null && priceInUnits >= askPriceMicros(lowest);

    if (willFill && lowest) {
      if (lowestAskCandidates.length >= 2 && !showAskChooserModal) {
        setShowAskChooserModal(true);
        return;
      }
      setErrorMsg("");
      try {
        await runInstantPurchase(lowest);
        setShowAskChooserModal(false);
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
    const tokenIds = merkleLeafTokenIds.map((x) => BigInt(x));
    if (tokenIds.length === 0) {
      setErrorMsg(
        merkleIsError
          ? "Could not load Merkle token set for this collection. Retry in a moment."
          : "No minted RWAs map to this collection bucket — you cannot place a criteria bid here.",
      );
      return;
    }

    const bidUnits = priceInUnits;
    setErrorMsg("");
    setPostBidMatchHint(null);

    try {
      if (!publicClient) {
        setErrorMsg("Network client not ready. Try again.");
        setStep("error");
        return;
      }
      /** Same as listings: wall clock can run ahead of `block.timestamp` and break Seaport’s startTime check. */
      const now = await getChainTimestampSec(publicClient);
      const endTime = now + BigInt(ORDER_DURATION_SECONDS);
      const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

      const tree = new SeaportMerkleTree(tokenIds);
      const rootHex = tree.getHexRoot();
      assertMerkleRootBytes32(rootHex);
      const merkleRootU256 = hexToBigInt(rootHex);

      let allowancePre = usdcAllowanceRaw as bigint | undefined;
      if (allowancePre === undefined) {
        allowancePre = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [address, SEAPORT_ADDRESS],
        });
      }
      const needsUsdcApprove = allowancePre < bidUnits;
      const usdcApproveGasPromise = needsUsdcApprove
        ? gasWithCapFast(
            publicClient,
            {
              address: USDC_ADDRESS,
              abi: USDC_ABI,
              functionName: "approve",
              args: [SEAPORT_ADDRESS, maxUint256],
              account: address,
            },
            GAS_FALLBACK.erc20Approve,
          )
        : Promise.resolve(null as bigint | null);

      setStep("signing");
      const orderMessage = {
        offerer: address,
        zone: ZERO_ADDRESS,
        offer: [
          {
            itemType: ITEM_ERC20,
            token: USDC_ADDRESS,
            identifierOrCriteria: BigInt(0),
            startAmount: bidUnits,
            endAmount: bidUnits,
          },
        ],
        consideration: [
          {
            itemType: ITEM_CRITERIA721,
            token: TOKENABLE_RWA_ADDRESS,
            identifierOrCriteria: merkleRootU256,
            startAmount: BigInt(1),
            endAmount: BigInt(1),
            recipient: address,
          },
        ],
        orderType: 0,
        startTime: now,
        endTime: endTime,
        zoneHash: ZERO_BYTES32,
        salt: salt,
        conduitKey: ZERO_BYTES32,
        counter: counter as bigint,
      };

      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: "Seaport",
          version: "1.5",
          chainId: sepolia.id,
          verifyingContract: SEAPORT_ADDRESS,
        },
        types: SEAPORT_ORDER_TYPES,
        primaryType: "OrderComponents",
        message: orderMessage as never,
      });

      if (needsUsdcApprove) {
        const allowanceAfterSign = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "allowance",
          args: [address, SEAPORT_ADDRESS],
        });
        if (allowanceAfterSign < bidUnits) {
          setStep("approving");
          const gasApprove =
            (await usdcApproveGasPromise) ??
            (await gasWithCapFast(
              publicClient,
              {
                address: USDC_ADDRESS,
                abi: USDC_ABI,
                functionName: "approve",
                args: [SEAPORT_ADDRESS, maxUint256],
                account: address,
              },
              GAS_FALLBACK.erc20Approve,
            ));
          await writeContractAsync({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "approve",
            args: [SEAPORT_ADDRESS, maxUint256],
            chainId: sepolia.id,
            gas: gasApprove,
          });
        }
      }

      setStep("submitting");
      const str = (v: unknown): string => String(v);
      const order = await createOrder({
        side: "bid",
        collectionKey,
        parameters: {
          offerer: str(orderMessage.offerer),
          zone: str(ZERO_ADDRESS),
          zoneHash: ZERO_BYTES32,
          startTime: str(now),
          endTime: str(endTime),
          orderType: 0,
          offer: [
            {
              itemType: ITEM_ERC20,
              token: USDC_ADDRESS,
              identifierOrCriteria: "0",
              startAmount: str(bidUnits),
              endAmount: str(bidUnits),
            },
          ],
          consideration: [
            {
              itemType: ITEM_CRITERIA721,
              token: TOKENABLE_RWA_ADDRESS,
              identifierOrCriteria: rootHex,
              startAmount: "1",
              endAmount: "1",
              recipient: address,
            },
          ],
          totalOriginalConsiderationItems: 1,
          salt: str(salt),
          conduitKey: ZERO_BYTES32,
          counter: str(counter),
        },
        signature,
        tokenContract: TOKENABLE_RWA_ADDRESS,
        tokenId: "0",
        considerationToken: USDC_ADDRESS,
        considerationAmount: str(bidUnits),
      });

      setStep("matching");
      const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
        writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0],
        )) as MatchWriteContractAsync;

      const matchResult = await tryMatchCriteriaBidAgainstBook({
        bid: order,
        collectionKey,
        address: address as Address,
        publicClient,
        writeContractAsync: matchWrite,
        listingHints: activeAsks,
      });

      if (matchResult.matched) {
        setLastOutcome("instant");
        onInstantBuyFillUsdc?.(matchResult.fillUsdc);
        setPostBidMatchHint(null);
        onPurchaseFilled?.();
      } else {
        setLastOutcome("bid");
        setPostBidMatchHint(matchResult.hint ?? null);
      }
      setStep("success");
      onPlaced?.(order);
      void invalidateAfterTrade();
    } catch (e: unknown) {
      setErrorMsg(mapWalletError(e).message);
      setStep("error");
    }
  }

  const busy = step !== "idle" && step !== "success" && step !== "error";

  /** Instant buy uses writeContract only; criteria bid needs walletClient for EIP-712. */
  const needsWalletSigner = !crossesBook;
  const walletSignerMissing = needsWalletSigner && isConnected && !walletClient;

  const submitDisabled =
    busy ||
    !address ||
    !publicClient ||
    !priceOk ||
    walletSignerMissing ||
    (!crossesBook && (!canPlaceCriteriaBid || merkleLoading));

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

  const embedded = variant === "embedded";

  const buyHelpTitle =
    "Price at or above the best ask: instant buy at that listing’s USDC price. Below best ask: post a collection bid up to your amount. Click the order book to pre-fill price.";

  return (
    <div
      className={
        embedded
          ? "min-w-0 overflow-x-hidden overflow-y-visible"
          : "rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]"
      }
    >
      {embedded ? (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 pt-0.5">
          <h2 className="text-xs font-semibold tracking-tight text-white">Buy</h2>
          <span
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded border border-zinc-800/80 text-[9px] font-semibold leading-none text-zinc-500"
            title={buyHelpTitle}
          >
            i
          </span>
        </div>
      ) : (
        <div className="border-b border-gray-800/80 px-4 pb-3 pt-4">
          <h2 className="text-lg font-bold tracking-tight text-white">Buy in this collection</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
            One price, one button: at or above the <span className="text-gray-400">best ask</span> you
            buy the <span className="text-gray-400">cheapest listing</span> (you pay its list price);
            below that you place a collection bid up to your amount.
          </p>
        </div>
      )}

      <div className={`${embedded ? "space-y-2 pt-2" : "space-y-4 px-4 py-4"}`}>
        <div
          className={`flex justify-between text-gray-500 ${embedded ? "text-[10px]" : "text-[11px]"}`}
        >
          <span title={embedded ? "Wallet USDC balance on-chain" : undefined}>
            {embedded ? "Balance" : "Wallet USDC"}
          </span>
          <span className="font-mono text-gray-400 tabular-nums">
            {balanceUsdc != null
              ? `${balanceUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>

        {lowestAsk ? (
          <p
            className="text-[10px] text-gray-600"
            title={
              feePercent() > 0
                ? `Best ask in book. Includes ${feePercent()}% platform fee in the flow.`
                : "Best ask (floor) in the order book."
            }
          >
            <span className="text-zinc-500">Ask</span>{" "}
            <span className="font-mono tabular-nums text-gray-400">{lowestAskUsdc}</span>
            <span className="text-gray-600"> · #{lowestAsk.tokenId}</span>
          </p>
        ) : (
          <p
            className="text-[10px] text-gray-600"
            title="Best ask is hidden when the book has no sells. You can still post a collection bid if this pool has minted RWAs."
          >
            {embedded
              ? "No asks in book."
              : "No active listings — you can still place a collection bid for this pool (covers all minted RWAs in the bucket)."}
          </p>
        )}

        {crossesBook && lowestAskCandidates.length >= 2 ? (
          <p className="text-[10px] text-zinc-500">
            {lowestAskCandidates.length} cards are listed at this floor price. Press{" "}
            <span className="text-zinc-300">Buy now</span> to choose one.
          </p>
        ) : null}

        <div>
          <label
            className={`block font-medium uppercase tracking-wide text-gray-500 mb-0.5 ${
              embedded ? "text-[9px]" : "text-[10px]"
            }`}
          >
            Price (USDC)
          </label>
          <div
            className={
              embedded
                ? "flex overflow-hidden rounded-md border border-zinc-700/90 bg-zinc-900/80 focus-within:border-zinc-500"
                : "flex rounded-md border border-gray-800 bg-black/50 overflow-hidden focus-within:border-gray-700"
            }
          >
            <input
              type="text"
              inputMode="decimal"
              placeholder="Amount in USDC"
              value={price}
              disabled={busy || !address}
              onChange={(e) => {
                priceTouchedRef.current = true;
                setPrice(e.target.value);
              }}
              className={`flex-1 min-w-0 bg-transparent text-white placeholder:text-gray-600 font-mono tabular-nums ${
                embedded ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm"
              }`}
            />
            <span
              className={`shrink-0 font-semibold border-l font-mono tabular-nums ${
                embedded
                  ? "border-zinc-700/90 bg-zinc-900/60 px-2 py-1.5 text-[10px] text-zinc-500"
                  : "text-gray-500 border-gray-800/90 bg-black/30 px-3 py-2.5 text-[11px]"
              }`}
            >
              USDC
            </span>
          </div>
        </div>

        {priceOk && crossesBook && lowestAsk && enteredAboveBestAsk && enteredUsdcLabel != null ? (
          <p
            className={`text-[10px] text-amber-200/80 ${embedded ? "leading-snug" : "leading-relaxed rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5"}`}
            title={`Instant buy charges the listing price (${lowestAskUsdc} USDC), not your typed amount.`}
          >
            {embedded
              ? `You pay ${lowestAskUsdc} USDC (list), not ${enteredUsdcLabel}.`
              : `You entered ${enteredUsdcLabel} USDC — you won&apos;t be charged that full amount; only ${lowestAskUsdc} USDC (listing price) is used for this purchase.`}
          </p>
        ) : null}

        {!embedded && priceOk && crossesBook && lowestAsk ? (
          <div className="space-y-1.5">
            <p className="text-[10px] leading-relaxed text-emerald-400/85">
              This price crosses the book — instant buy uses the{" "}
              <span className="font-semibold">cheapest listing</span>: token #{lowestAsk.tokenId} at{" "}
              {lowestAskUsdc} USDC (that&apos;s what you pay on-chain).
            </p>
          </div>
        ) : null}

        {!embedded && priceOk && !crossesBook ? (
          <p className="text-[10px] leading-relaxed text-gray-600">
            Below best ask — collection bid at your amount. Minted token(s) in this pool (Merkle):{" "}
            <span className="font-mono text-gray-400">
              {merkleLoading ? "…" : merkleLeafTokenIds.length}
            </span>
            .
          </p>
        ) : null}

        {embedded && priceOk && !crossesBook ? (
          <p
            className="text-[10px] text-zinc-600"
            title="Merkle leaves = every minted RWA in this collection bucket so new listings stay matchable."
          >
            Bid ·{" "}
            {merkleLoading ? "…" : `${merkleLeafTokenIds.length} token${merkleLeafTokenIds.length === 1 ? "" : "s"}`}{" "}
            in pool
          </p>
        ) : null}

        {merkleIsError ? (
          <p className="text-[10px] text-rose-400/90">
            Could not load pool Merkle set. Check your connection and retry.
          </p>
        ) : null}

        <button
          type="button"
          disabled={submitDisabled}
          onClick={() => void handleSubmit()}
          title={
            crossesBook && lowestAsk
              ? `Instant buy: pay ${lowestAskUsdc} USDC for token #${lowestAsk.tokenId} (listing price).`
              : !crossesBook && priceOk
                ? "Sign a collection bid up to your entered USDC amount."
                : undefined
          }
          className={`w-full min-h-[40px] font-bold text-white shadow-md shadow-black/20 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 ${
            embedded
              ? "rounded-md bg-[#16A34A] px-3 py-2 text-xs"
              : "rounded-xl bg-emerald-600 py-3 text-sm hover:bg-emerald-500"
          }`}
        >
          {!address
            ? embedded
              ? "Connect"
              : "Connect wallet"
            : walletSignerMissing
              ? embedded
                ? "Open wallet"
                : "Open wallet…"
              : busy
                ? busyLabel
                : crossesBook && lowestAsk
                  ? "Buy now"
                  : embedded
                    ? "Place bid"
                    : "Buy"}
        </button>

        {errorMsg && (
          <p className={`text-rose-400/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}>
            {errorMsg}
          </p>
        )}
        {step === "success" && (
          <>
            <p
              className={`text-emerald-400/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}
              title={
                lastOutcome === "instant"
                  ? "Purchase complete — check your wallet for the RWA."
                  : "Collection bid is on the book; sellers can fulfill against it."
              }
            >
              {embedded
                ? lastOutcome === "instant"
                  ? "Bought."
                  : "Bid placed."
                : lastOutcome === "instant"
                  ? "Purchase complete. The RWA is in your wallet."
                  : "Collection bid saved. Sellers can match from their listing."}
            </p>
            {lastOutcome === "bid" && postBidMatchHint ? (
              <p
                className={`text-amber-200/85 ${embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
              >
                {postBidMatchHint}
              </p>
            ) : null}
          </>
        )}

        {!embedded && (
          <div className="pt-2 border-t border-gray-800/80">
            <p className="text-[11px] text-gray-500 mb-2">
              Selling is per token: list a specific RWA from your wallet.
            </p>
            {onOpenSellModal ? (
              <button
                type="button"
                onClick={onOpenSellModal}
                title="Open listing flow for this collection"
                className="w-full min-h-[40px] text-center rounded-md py-2 text-xs font-bold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
              >
                List for sale
              </button>
            ) : (
              <Link
                href="/portfolio"
                title="Manage assets and create listings"
                className="block w-full min-h-[40px] text-center rounded-md py-2 text-xs font-bold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
              >
                My Assets
              </Link>
            )}
          </div>
        )}
      </div>

      {showAskChooserModal && crossesBook && lowestAskCandidates.length >= 2 ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close card chooser"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setShowAskChooserModal(false)}
          />
          <div className="relative z-[131] w-full max-w-3xl rounded-2xl border border-zinc-700/90 bg-zinc-950 p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white sm:text-lg">Choose card to buy</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {lowestAskCandidates.length} cards at {lowestAskUsdc ?? "floor"} USDC.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAskChooserModal(false)}
                className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 scrollbar-platform sm:grid-cols-3">
              {lowestAskCandidates.map((o) => {
                const tokenId = Number(o.tokenId);
                const meta = floorMetaByTokenId.get(tokenId);
                const selected = lowestAsk?.orderHash === o.orderHash;
                return (
                  <button
                    key={o.orderHash}
                    type="button"
                    onClick={() => setSelectedFloorAskHash(o.orderHash)}
                    className={`rounded-xl border p-2 text-left transition-colors ${
                      selected
                        ? "border-mint/45 bg-mint/[0.10]"
                        : "border-zinc-700/70 bg-zinc-900/60 hover:border-zinc-500/80"
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-900">
                      {meta?.imageUrl ? (
                        <img
                          src={meta.imageUrl}
                          alt={meta?.name ?? `Token #${tokenId}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                          #{tokenId}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs font-semibold text-zinc-200">
                      {meta?.name ?? `Token #${tokenId}`}
                    </p>
                    <p className="mt-0.5 text-[11px] font-mono text-zinc-400">
                      #{tokenId} · {formatUsdc6(String(askPriceMicros(o)))} USDC
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAskChooserModal(false)}
                className="rounded-md border border-zinc-700/90 bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy || !lowestAsk}
                className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "Buying…" : `Buy selected · ${lowestAskUsdc ?? "USDC"}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
