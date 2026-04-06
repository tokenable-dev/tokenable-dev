"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatUnits, hexToBigInt, maxUint256, parseUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import { createOrder, fulfillOrderApi, type Order } from "@/lib/api";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";
import { assertMerkleRootBytes32, u256Hex32 } from "@/lib/seaport/eip712Uint";
import {
  FULFILL_EXTRA_DATA,
  fulfillSeaportOrderArgs,
} from "@/lib/seaportFulfillOrderArgs";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";

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

function formatUsdc6(amountStr: string): string {
  try {
    const n = Number(formatUnits(BigInt(amountStr), 6));
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return amountStr;
  }
}

/** Same rule as backend `merkleEligibleTokenIds`: active ask rows → distinct token_id strings. */
function merkleTokenIdsFromActiveAsks(asks: Order[]): string[] {
  const idsAsk = asks
    .filter((o) => o.status === "active" && isListingAskRow(o))
    .map((o) => String(o.tokenId ?? "").trim())
    .filter((id) => id !== "");
  const ids = [...new Set(idsAsk)];
  ids.sort((a, b) => {
    const ba = BigInt(a);
    const bb = BigInt(b);
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  });
  return ids;
}

export function CollectionCriteriaBidPanel({
  collectionKey,
  activeAsks = [],
  /** Prefer parent (Zustand) address so this panel matches OrderBook / rest of page. */
  connectedAddress,
  onPlaced,
  onOpenSellModal,
}: {
  collectionKey: string;
  activeAsks?: Order[];
  connectedAddress?: `0x${string}` | string | null;
  onPlaced?: (order: Order) => void;
  onOpenSellModal?: () => void;
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

  const [price, setPrice] = useState("");
  const priceTouchedRef = useRef(false);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastOutcome, setLastOutcome] = useState<"instant" | "bid" | null>(null);

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

  /** 오더북과 동일한 activeAsks에서 Merkle leaf 후보를 뽑음 — 별도 merkle-set API 캐시와 어긋나 입찰이 막히는 문제 방지 */
  const bidMerkleTokenIds = useMemo(
    () => merkleTokenIdsFromActiveAsks(activeAsks),
    [activeAsks]
  );

  const lowestAsk = useMemo(() => pickLowestActiveAsk(activeAsks), [activeAsks]);

  const lowestAskUsdc = lowestAsk ? formatUsdc6(String(askPriceMicros(lowestAsk))) : null;

  /** Prefill so Buy isn’t stuck disabled on empty input (common after page load). */
  useEffect(() => {
    if (priceTouchedRef.current || !lowestAsk) return;
    try {
      const s = formatUnits(askPriceMicros(lowestAsk), 6);
      const n = parseFloat(s);
      setPrice(Number.isFinite(n) ? String(n) : s);
    } catch {
      /* ignore */
    }
  }, [lowestAsk]);

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

  const canPlaceCriteriaBid = bidMerkleTokenIds.length > 0 && counter !== undefined;

  const priceOk = priceInUnits != null;

  async function invalidateAfterTrade() {
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
    await queryClient.invalidateQueries({ queryKey: ["my-rwa-ids"] });
    await queryClient.invalidateQueries({ queryKey: ["my-rwas"] });
    await queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === "readContract",
    });
  }

  async function runInstantPurchase(ask: Order) {
    if (!address || !publicClient) return;
    const payUnits = askPriceMicros(ask);

    let allowance = usdcAllowanceRaw as bigint | undefined;
    if (allowance === undefined) {
      allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "allowance",
        args: [address, SEAPORT_ADDRESS],
      });
    }

    /** Fulfill 가스 추정을 approve·영수증 대기와 겹쳐서 두 번째 트랜잭션 팝업까지 지연 완화 */
    const gasFulfillPromise = gasWithCapFast(
      publicClient,
      {
        address: SEAPORT_ADDRESS,
        abi: SEAPORT_ABI,
        functionName: "fulfillOrder",
        args: [fulfillSeaportOrderArgs(ask), FULFILL_EXTRA_DATA],
        account: address,
      },
      GAS_FALLBACK.fulfillOrder,
    );

    if (allowance < payUnits) {
      setStep("approving");
      const gasApprovePromise = gasWithCapFast(
        publicClient,
        {
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, payUnits],
          account: address,
        },
        GAS_FALLBACK.erc20Approve,
      );
      const gasApprove = await gasApprovePromise;
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, payUnits],
        chainId: sepolia.id,
        gas: gasApprove,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }

    setStep("buying");
    const gasFulfill = await gasFulfillPromise;
    const fulfillTx = await writeContractAsync({
      address: SEAPORT_ADDRESS,
      abi: SEAPORT_ABI,
      functionName: "fulfillOrder",
      args: [fulfillSeaportOrderArgs(ask), FULFILL_EXTRA_DATA],
      chainId: sepolia.id,
      gas: gasFulfill,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: fulfillTx });
    if (receipt.status === "reverted") {
      throw new Error("Purchase was reverted on-chain. Check USDC balance and try again.");
    }

    await fulfillOrderApi(ask.orderHash);
    setLastOutcome("instant");
    setStep("success");
    onPlaced?.(ask);
    void invalidateAfterTrade();
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

    const lowest = pickLowestActiveAsk(activeAsks);
    const willFill = lowest != null && priceInUnits >= askPriceMicros(lowest);

    if (willFill && lowest) {
      setErrorMsg("");
      try {
        await runInstantPurchase(lowest);
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
    const tokenIds = bidMerkleTokenIds.map((x) => BigInt(x));
    if (tokenIds.length === 0) {
      setErrorMsg("No active listings in this book to anchor a collection bid.");
      return;
    }

    const bidUnits = priceInUnits;
    setErrorMsg("");
    const now = BigInt(Math.floor(Date.now() / 1000));
    const endTime = now + BigInt(ORDER_DURATION_SECONDS);
    const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

    try {
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
            identifierOrCriteria: u256Hex32(BigInt(0)),
            startAmount: u256Hex32(bidUnits),
            endAmount: u256Hex32(bidUnits),
          },
        ],
        consideration: [
          {
            itemType: ITEM_CRITERIA721,
            token: TOKENABLE_RWA_ADDRESS,
            identifierOrCriteria: u256Hex32(merkleRootU256),
            startAmount: u256Hex32(BigInt(1)),
            endAmount: u256Hex32(BigInt(1)),
            recipient: address,
          },
        ],
        orderType: 0,
        startTime: u256Hex32(now),
        endTime: u256Hex32(endTime),
        zoneHash: ZERO_BYTES32,
        salt: u256Hex32(salt),
        conduitKey: ZERO_BYTES32,
        counter: u256Hex32(counter as bigint),
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

      setLastOutcome("bid");
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
    (!crossesBook && !canPlaceCriteriaBid);

  const busyLabel =
    step === "approving"
      ? "Approving USDC…"
      : step === "buying"
        ? "Completing purchase…"
        : step === "signing"
          ? "Sign in wallet…"
          : step === "submitting"
            ? "Submitting…"
            : step;

  return (
    <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]">
      <div className="px-4 pt-4 pb-3 border-b border-gray-800/80">
        <h2 className="text-lg font-bold text-white tracking-tight">Buy in this collection</h2>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          One amount, one action: if your price is at or above the{" "}
          <span className="text-gray-400">best ask</span>, you buy that listing now; otherwise you
          place a collection bid at your max USDC.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Wallet USDC</span>
          <span className="font-mono text-gray-400 tabular-nums">
            {balanceUsdc != null
              ? `${balanceUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>

        {lowestAsk ? (
          <p className="text-[10px] text-gray-600">
            Best ask:{" "}
            <span className="font-mono text-gray-400 tabular-nums">{lowestAskUsdc} USDC</span>
            <span className="text-gray-600"> · token #{lowestAsk.tokenId}</span>
          </p>
        ) : (
          <p className="text-[10px] text-gray-600">
            No active listings — add a listing first, or wait for sellers (collection bids need asks in
            the book).
          </p>
        )}

        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
            Price (USDC)
          </label>
          <div className="flex rounded-lg border border-gray-800 bg-black/50 overflow-hidden focus-within:border-gray-700">
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
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-gray-600 font-mono tabular-nums"
            />
            <span className="shrink-0 px-3 py-2.5 text-[11px] font-semibold text-gray-500 border-l border-gray-800/90 bg-black/30">
              USDC
            </span>
          </div>
        </div>

        {priceOk && crossesBook && lowestAsk ? (
          <div className="space-y-1.5">
            <p className="text-[10px] text-emerald-400/85 leading-relaxed">
              This price crosses the book — instant buy uses the{" "}
              <span className="font-semibold">cheapest listing</span>: token #{lowestAsk.tokenId}{" "}
              at {lowestAskUsdc} USDC (that&apos;s what you pay on-chain).
            </p>
            {enteredAboveBestAsk && enteredUsdcLabel != null ? (
              <p className="text-[10px] text-amber-200/70 leading-relaxed rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5">
                You entered {enteredUsdcLabel} USDC — you won&apos;t be charged that full amount;
                only {lowestAskUsdc} USDC (listing price) is used for this purchase.
              </p>
            ) : null}
          </div>
        ) : priceOk && !crossesBook ? (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Below best ask — places a collection bid at your amount. Eligible token(s) in book:{" "}
            <span className="text-gray-400 font-mono">{bidMerkleTokenIds.length}</span>.
          </p>
        ) : null}

        <button
          type="button"
          disabled={submitDisabled}
          onClick={() => void handleSubmit()}
          className="w-full rounded-xl py-3 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {!address
            ? "Connect wallet"
            : walletSignerMissing
              ? "Open wallet…"
              : busy
                ? busyLabel
                : crossesBook && lowestAsk
                  ? `Buy now · ${lowestAskUsdc} USDC`
                  : "Buy"}
        </button>

        {errorMsg && <p className="text-[11px] text-rose-400/90">{errorMsg}</p>}
        {step === "success" && (
          <p className="text-[11px] text-emerald-400/90">
            {lastOutcome === "instant"
              ? "Purchase complete. The RWA is in your wallet."
              : "Collection bid saved. Sellers can match from their listing."}
          </p>
        )}

        <div className="pt-2 border-t border-gray-800/80">
          <p className="text-[11px] text-gray-500 mb-2">
            Selling is per token: list a specific RWA from your wallet.
          </p>
          {onOpenSellModal ? (
            <button
              type="button"
              onClick={onOpenSellModal}
              className="w-full text-center rounded-lg py-2.5 text-sm font-semibold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
            >
              List for sale in this collection
            </button>
          ) : (
            <Link
              href="/?tab=my-rwa"
              className="block text-center rounded-lg py-2.5 text-sm font-semibold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
            >
              My Assets — list for sale
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
