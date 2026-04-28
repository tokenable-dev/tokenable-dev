"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { USDC_ADDRESS, USDC_ABI } from "@/constants/contracts";
import type { Order } from "@/lib/core";
import { fulfillAskListingOrder } from "@/lib/seaport/fulfillAskListing";
import { mapWalletError } from "@/lib/network";

function formatUsdcPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

export type BookRowSelection =
  | {
      side: "ask";
      levelKey: string;
      price: number;
      orders: Order[];
    }
  | {
      side: "bid";
      levelKey: string;
      price: number;
      orders: Order[];
    };

interface CollectionTradeTicketProps {
  selection: BookRowSelection | null;
  address: Address | undefined;
  onBuySuccess?: () => void;
  onOpenSellModal: () => void;
  /** Buy: book + instant buy. Sell: listing flow only. */
  flow: "buy" | "sell";
  collectionLabel?: string;
  listingCount?: number;
}

/**
 * Order form: instant buy from book (flow=buy) or list-for-sale CTA (flow=sell).
 */
export function CollectionTradeTicket({
  selection,
  address,
  onBuySuccess,
  onOpenSellModal,
  flow,
  collectionLabel,
  listingCount = 0,
}: CollectionTradeTicketProps) {
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();

  const { data: usdcBalRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
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
    setPriceInput(formatUsdcPrice(selection.price));
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
        chainId: sepolia.id,
      });
      onBuySuccess?.();
    } catch (e: unknown) {
      setBuyErr(mapWalletError(e).message);
    } finally {
      setBuyBusy(false);
    }
  }

  if (flow === "sell") {
    const listTitle =
      "Choose an asset from your wallet, set a USDC price, and list it in this collection’s order book.";
    const bidHint =
      selection?.side === "bid"
        ? `Bid row ${formatUsdcPrice(selection.price)} USDC — List / Change price prefills this amount; if you already have a higher ask, use Change price to lower it and we’ll try to match this bid after you sign.`
        : selection?.side === "ask"
          ? "Red row is someone else’s listing — use Buy to purchase it, or open List for sale to set your own price."
          : null;
    return (
      <div className="w-full space-y-2" aria-label="Sell">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 pt-0.5">
          <h2 className="text-xs font-semibold tracking-tight text-white">Sell</h2>
          <span
            className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded border border-zinc-800/80 text-[9px] font-semibold leading-none text-zinc-500"
            title={listTitle}
          >
            i
          </span>
        </div>
        {bidHint ? (
          <p className="text-[10px] leading-snug text-zinc-500 pt-1">{bidHint}</p>
        ) : null}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onOpenSellModal}
            title={listTitle}
            className="w-full min-h-[40px] rounded-md bg-[#DC2626] px-3 py-2 text-xs font-bold text-white shadow-md shadow-black/25 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40"
          >
            List for sale
          </button>
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[9px] text-zinc-500">
            <Link href="/portfolio" className="hover:text-zinc-400" title="Manage RWAs in your wallet">
              My Assets
            </Link>
            {listingCount > 0 ? (
              <Link
                href="#collection-listings"
                className="tabular-nums hover:text-zinc-400"
                title="Scroll to listings in this collection"
              >
                {listingCount} listing{listingCount === 1 ? "" : "s"}
              </Link>
            ) : (
              <span title="No other listings in this collection yet">0 listings</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hint =
    selection?.side === "bid"
      ? "Bid row — price for collection bid below."
      : selection?.side === "ask"
        ? "Ask row — buy at listed USDC."
        : "Tap the book to set price (asks = buy now).";

  const inputShell =
    "rounded-md border border-zinc-700/90 bg-zinc-900/80 overflow-hidden focus-within:border-zinc-500";

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
          className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded border border-zinc-800/80 text-[9px] font-semibold leading-none text-zinc-500"
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
              className="w-full rounded-md border border-zinc-700/90 bg-zinc-900/80 px-2 py-1.5 text-xs text-white font-mono tabular-nums read-only:opacity-90"
              placeholder="1"
            />
          </div>

          {selection?.side === "ask" && askOrders.length > 1 && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <select
                value={askPickIdx}
                onChange={(e) => setAskPickIdx(Number(e.target.value))}
                className="w-full rounded-md border border-zinc-700/90 bg-zinc-900/80 py-1.5 px-2 text-xs font-mono text-white"
              >
                {askOrders.map((o, i) => (
                  <option key={o.orderHash} value={i}>
                    #{o.tokenId} · {formatUsdcPrice(priceUsdcFromOrder(o))}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selection?.side === "ask" && askOrders.length <= 1 && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <div className="rounded-md border border-zinc-700/90 bg-zinc-900/80 px-2 py-1.5 text-xs font-mono text-zinc-300 tabular-nums">
                {selectedAsk ? `#${selectedAsk.tokenId}` : "—"}
              </div>
            </div>
          )}

          {selection?.side === "bid" && (
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-medium text-zinc-300">Token</label>
              <div className="rounded-md border border-zinc-700/90 bg-zinc-900/80 px-2 py-1.5 text-xs font-mono text-zinc-600">
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
