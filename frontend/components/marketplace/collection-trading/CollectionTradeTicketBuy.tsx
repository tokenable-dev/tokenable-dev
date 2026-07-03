"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { USDC_ABI } from "@/constants/contracts";
import { useAppChain } from "@/providers/AppChainProvider";
import { useChainContracts } from "@/hooks/chain/useChainContracts";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import { fulfillAskListingOrder } from "@/lib/seaport/orders/fulfillAskListing";
import { mapWalletError } from "@/lib/network";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import {
  formatTradeTicketUsdcPrice,
  priceUsdcFromOrder,
} from "@/lib/marketplace/collection-trading/orderUsdcFormat";

export function CollectionTradeTicketBuy({
  selection,
  address,
  onBuySuccess,
}: {
  selection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess?: () => void;
}) {
  const { chainId } = useAppChain();
  const { usdcAddress } = useChainContracts();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();

  const { data: usdcBalRaw } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  const balanceUsdc = useMemo(() => {
    if (usdcBalRaw == null) return null;
    return Number(formatUnits(usdcBalRaw as bigint, 6));
  }, [usdcBalRaw]);

  const [priceInput, setPriceInput] = useState("");
  const [amountInput, setAmountInput] = useState("1");
  const [askPickIdx, setAskPickIdx] = useState(0);
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyErr, setBuyErr] = useState<string | null>(null);

  const askOrders = useMemo(() => {
    if (selection?.side !== "ask" || !selection.orders.length) return [];
    return [...selection.orders].sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
  }, [selection]);

  const selectedAsk = askOrders[askPickIdx] ?? null;

  useEffect(() => {
    setAskPickIdx(0);
    setBuyErr(null);
    if (!selection) {
      setPriceInput("");
      setAmountInput("1");
      return;
    }
    setPriceInput(formatTradeTicketUsdcPrice(selection.price));
    setAmountInput("1");
  }, [selection]);

  async function handleBuyListing() {
    setBuyErr(null);
    if (!address || !publicClient || !selectedAsk) {
      setBuyErr("Select a red (ask) row in the book or connect your wallet.");
      return;
    }
    const qty = Number(amountInput.replace(/,/g, "").trim());
    if (!Number.isFinite(qty) || qty !== 1) {
      setBuyErr("Each listing is one NFT — amount must be 1.");
      return;
    }
    setBuyBusy(true);
    try {
      await fulfillAskListingOrder({
        ask: selectedAsk,
        address,
        publicClient,
        writeContractAsync: writeContractAsync as Parameters<
          typeof fulfillAskListingOrder
        >[0]["writeContractAsync"],
        chainId,
      });
      onBuySuccess?.();
    } catch (e: unknown) {
      setBuyErr(mapWalletError(e).message);
    } finally {
      setBuyBusy(false);
    }
  }

  const hint =
    selection?.side === "bid"
      ? "Bid row — price for collection bid below."
      : selection?.side === "ask"
        ? "Ask row — buy at listed USDC."
        : "Tap the book to set price (asks = buy now).";

  const inputShell = `rounded-md ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} overflow-hidden focus-within:border-zinc-500`;

  return (
    <div className="w-full" aria-label="Buy">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[9px] text-zinc-500">
        <span className="tabular-nums" title="USDC balance in your wallet">
          Bal{" "}
          <span className="text-zinc-300">
            {balanceUsdc != null
              ? `${balanceUsdc.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "—"}
          </span>
        </span>
        <span
          className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded ${COLLECTION_DETAILS_BORDER_ALL} text-[9px] font-semibold leading-none text-zinc-500`}
          title={hint}
        >
          i
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1 block text-[10px] font-medium text-zinc-300">Price (USDC)</label>
            <div className={inputShell}>
              <input
                type="text"
                inputMode="decimal"
                readOnly={selection?.side === "ask"}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                title="USDC"
                className="w-full bg-transparent px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 font-mono tabular-nums read-only:opacity-90"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10px] font-medium text-zinc-300">Amount</label>
            <input
              type="text"
              inputMode="numeric"
              readOnly={selection?.side === "ask"}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              title="NFTs per transaction"
              className={`w-full rounded-md ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-2 py-1.5 text-xs text-white font-mono tabular-nums read-only:opacity-90`}
              placeholder="1"
            />
          </div>

          {selection?.side === "ask" && askOrders.length > 1 && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <select
                value={askPickIdx}
                onChange={(e) => setAskPickIdx(Number(e.target.value))}
                className={`w-full rounded-md ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} py-1.5 px-2 text-xs font-mono text-white`}
              >
                {askOrders.map((o, i) => (
                  <option key={o.orderHash} value={i}>
                    #{o.tokenId} · {formatTradeTicketUsdcPrice(priceUsdcFromOrder(o))}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selection?.side === "ask" && askOrders.length <= 1 && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <div
                className={`rounded-md ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-2 py-1.5 text-xs font-mono text-zinc-300 tabular-nums`}
              >
                {selectedAsk ? `#${selectedAsk.tokenId}` : "—"}
              </div>
            </div>
          )}

          {selection?.side === "bid" && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <div
                className={`rounded-md ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-2 py-1.5 text-xs font-mono text-zinc-600`}
              >
                Any (criteria)
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={buyBusy || !address || selection?.side !== "ask" || selectedAsk == null}
          onClick={() => void handleBuyListing()}
          className="w-full min-h-[40px] rounded-md bg-[#16A34A] px-3 py-2 text-xs font-bold text-white shadow-md shadow-black/20 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
        >
          {buyBusy ? "…" : "Buy now"}
        </button>
      </div>

      {buyErr && <p className="mt-2 text-[10px] text-rose-400/90">{buyErr}</p>}
    </div>
  );
}
