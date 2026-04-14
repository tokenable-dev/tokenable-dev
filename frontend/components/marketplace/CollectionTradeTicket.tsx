"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { USDC_ADDRESS, USDC_ABI } from "@/constants/contracts";
import type { Order } from "@/lib/api";
import { fulfillAskListingOrder } from "@/lib/seaport/fulfillAskListing";
import { mapWalletError } from "@/lib/walletError";

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
}

/**
 * Full-width bottom bar: [ Price | Amount | … ] left, [ Buy | Sell ] right (same row on desktop).
 */
export function CollectionTradeTicket({
  selection,
  address,
  onBuySuccess,
  onOpenSellModal,
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
      setBuyErr("Select a sell row in the book (top / asks) or connect your wallet.");
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

  const hint =
    selection?.side === "bid"
      ? "Bid row → price synced to collection bid below."
      : selection?.side === "ask"
        ? "Ask row → buy at listed USDC."
        : "Click a book row to fill price.";

  return (
    <div className="w-full" aria-label="Trade">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-3 text-[10px] text-gray-500">
        <span className="tabular-nums">
          Avbl{" "}
          <span className="text-gray-400">
            {balanceUsdc != null
              ? `${balanceUsdc.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "—"}{" "}
            USDC
          </span>
        </span>
        <span className="text-gray-600 truncate max-w-[min(100%,360px)] text-right" title={hint}>
          {hint}
        </span>
      </div>

      {/* One row: inputs left, buttons right (reference UI) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="flex flex-1 flex-wrap items-end gap-4 min-w-0">
          <div className="w-full min-[400px]:w-auto min-[400px]:min-w-[140px] min-[400px]:max-w-[200px]">
            <label className="block text-[12px] font-medium text-gray-200 mb-1.5">
              Price (USDC)
            </label>
            <div className="rounded-lg border border-gray-700/90 bg-[#1a1d24] overflow-hidden focus-within:border-gray-500">
              <input
                type="text"
                inputMode="decimal"
                readOnly={selection?.side === "ask"}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                title="USDC"
                className="w-full bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-gray-600 font-mono tabular-nums read-only:opacity-90"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="w-full min-[400px]:w-auto min-[400px]:min-w-[100px] min-[400px]:max-w-[140px]">
            <label className="block text-[12px] font-medium text-gray-200 mb-1.5">Amount</label>
            <input
              type="text"
              inputMode="numeric"
              readOnly={selection?.side === "ask"}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              title="NFTs per transaction"
              className="w-full rounded-lg border border-gray-700/90 bg-[#1a1d24] px-3 py-2.5 text-sm text-white font-mono tabular-nums read-only:opacity-90"
              placeholder="1"
            />
          </div>

          {selection?.side === "ask" && askOrders.length > 1 && (
            <div className="w-full min-[400px]:w-auto min-[400px]:min-w-[160px] min-[400px]:max-w-[240px]">
              <label className="block text-[12px] font-medium text-gray-200 mb-1.5">Token</label>
              <select
                value={askPickIdx}
                onChange={(e) => setAskPickIdx(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700/90 bg-[#1a1d24] py-2.5 px-2.5 text-sm font-mono text-white"
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
            <div className="w-full min-[400px]:w-auto min-[400px]:min-w-[88px]">
              <label className="block text-[12px] font-medium text-gray-200 mb-1.5">Token</label>
              <div className="rounded-lg border border-gray-700/90 bg-[#1a1d24] px-3 py-2.5 text-sm font-mono text-gray-300 tabular-nums">
                {selectedAsk ? `#${selectedAsk.tokenId}` : "—"}
              </div>
            </div>
          )}

          {selection?.side === "bid" && (
            <div className="w-full min-[400px]:w-auto min-[400px]:min-w-[88px]">
              <label className="block text-[12px] font-medium text-gray-200 mb-1.5">Token</label>
              <div className="rounded-lg border border-gray-700/90 bg-[#1a1d24] px-3 py-2.5 text-sm font-mono text-gray-500">
                —
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 w-full lg:w-auto lg:shrink-0 lg:max-w-[min(100%,420px)]">
          <button
            type="button"
            disabled={buyBusy || !address || selection?.side !== "ask" || selectedAsk == null}
            onClick={() => void handleBuyListing()}
            className="flex-1 min-h-[46px] min-w-0 rounded-lg bg-[#22C55E] px-6 py-3 text-sm font-bold text-gray-900 shadow-md shadow-black/20 transition hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
          >
            {buyBusy ? "…" : "Buy"}
          </button>
          <button
            type="button"
            onClick={onOpenSellModal}
            className="flex-1 min-h-[46px] min-w-0 rounded-lg bg-[#EF4444] px-6 py-3 text-sm font-bold text-white shadow-md shadow-black/20 transition hover:brightness-105 active:scale-[0.99]"
          >
            Sell
          </button>
        </div>
      </div>

      {buyErr && <p className="text-[11px] text-rose-400/90 mt-3">{buyErr}</p>}
    </div>
  );
}
