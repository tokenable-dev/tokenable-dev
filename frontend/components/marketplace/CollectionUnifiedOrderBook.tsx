"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatUnits } from "viem";
import type { BucketBid, Order } from "@/lib/api";

function priceUsdcOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

function priceUsdcPool(b: BucketBid): number {
  try {
    return Number(formatUnits(BigInt(b.considerationAmount), 6));
  } catch {
    return 0;
  }
}

function shortAddr(a: string) {
  const x = a.startsWith("0x") ? a : `0x${a}`;
  if (x.length <= 14) return x;
  return `${x.slice(0, 6)}…${x.slice(-4)}`;
}

type Row =
  | { kind: "ask"; price: number; order: Order; tokenId: number }
  | { kind: "pool"; price: number; bid: BucketBid }
  | { kind: "seaport"; price: number; order: Order; tokenId: number };

type AskRow = Extract<Row, { kind: "ask" }>;

/** 컬렉션 단일 오더북: 매도(asks) + 풀 매수 + Seaport 매수 */
export function CollectionUnifiedOrderBook({
  asks,
  poolBids,
  seaportBids,
  address,
  onCancelPoolBid,
  sellerTokenInput,
  onSellerTokenInput,
  variant = "full",
  className = "",
}: {
  asks: Order[];
  poolBids: BucketBid[];
  seaportBids: Order[];
  address?: string;
  onCancelPoolBid?: (bid: BucketBid) => void;
  sellerTokenInput: string;
  onSellerTokenInput: (v: string) => void;
  variant?: "compact" | "full";
  className?: string;
}) {
  const router = useRouter();

  const { askRows, buyRows, maxPx } = useMemo(() => {
    const askList: AskRow[] = [...asks]
      .sort((a, b) => priceUsdcOrder(a) - priceUsdcOrder(b))
      .map((o) => ({
        kind: "ask" as const,
        price: priceUsdcOrder(o),
        order: o,
        tokenId: Number(o.tokenId),
      }));

    const poolList: Row[] = poolBids.map((b) => ({
      kind: "pool" as const,
      price: priceUsdcPool(b),
      bid: b,
    }));

    const seaList: Row[] = seaportBids.map((o) => ({
      kind: "seaport" as const,
      price: priceUsdcOrder(o),
      order: o,
      tokenId: Number(o.tokenId),
    }));

    const buyCombined = [...poolList, ...seaList].sort(
      (a, b) => b.price - a.price
    );

    const allPrices = [
      ...askList.map((r) => r.price),
      ...buyCombined.map((r) => r.price),
    ];
    const maxPx = allPrices.length ? Math.max(...allPrices, 1e-9) : 1;

    return {
      askRows: askList,
      buyRows: buyCombined,
      maxPx,
    };
  }, [asks, poolBids, seaportBids]);

  const sellTid = parseInt(sellerTokenInput.replace(/\D/g, ""), 10);
  const sellTidOk =
    sellerTokenInput.replace(/\D/g, "").length > 0 &&
    Number.isFinite(sellTid) &&
    sellTid >= 0;

  const isFull = variant === "full";
  const shell =
    "rounded-xl border border-gray-800 bg-[#0b0e11] overflow-hidden flex flex-col " +
    (isFull
      ? "w-full max-w-none max-h-[min(88vh,780px)] shadow-lg shadow-black/40"
      : "max-h-[min(70vh,560px)]");

  const head =
    "grid gap-2 px-3 py-2 font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800/80 " +
    (isFull
      ? "grid-cols-[72px_1fr_48px_1fr_80px] text-xs"
      : "grid-cols-[64px_1fr_40px_1fr_72px] text-[10px]");

  const rowGrid =
    "grid gap-2 w-full px-3 font-mono tabular-nums items-center " +
    (isFull
      ? "grid-cols-[72px_1fr_48px_1fr_80px] text-sm min-h-[40px]"
      : "grid-cols-[64px_1fr_40px_1fr_72px] text-[11px] min-h-[34px]");

  const totalRows = askRows.length + buyRows.length;

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="px-4 py-3 border-b border-gray-800/90 flex items-center justify-between gap-2">
        <div>
          <h3
            className={`font-bold text-white tracking-wide ${isFull ? "text-sm" : "text-xs"}`}
          >
            Order book
          </h3>
          <p
            className={`text-gray-500 mt-0.5 ${isFull ? "text-xs" : "text-[10px]"}`}
          >
            Sell orders, pool buy interest, and Seaport bids — one view
          </p>
        </div>
        <span
          className={`font-mono text-gray-500 ${isFull ? "text-xs" : "text-[10px]"}`}
        >
          {totalRows} rows
        </span>
      </div>

      <div className={head}>
        <span>Side</span>
        <span>Price (USDC)</span>
        <span className="text-right">Qty</span>
        <span>Detail</span>
        <span className="text-right"> </span>
      </div>

      <div
        className={`overflow-y-auto flex-1 py-1 space-y-px min-h-[140px] ${
          isFull ? "px-1" : "px-1"
        }`}
      >
        {askRows.length > 0 && (
          <p className="px-3 py-1 text-[10px] font-semibold text-rose-400/90 uppercase tracking-wide">
            Sell · asks
          </p>
        )}
        {askRows.map(({ order, price, tokenId }) => {
          const depth = price / maxPx;
          return (
            <Link
              key={order.orderHash}
              href={`/marketplace/${tokenId}`}
              className={`relative flex rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors group ${
                isFull ? "min-h-[42px]" : ""
              }`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-rose-500/[0.12]"
                style={{ width: `${Math.min(100, depth * 100)}%` }}
              />
              <div className={`relative z-10 ${rowGrid}`}>
                <span className="text-rose-300/90 text-[10px] font-bold">Sell</span>
                <span className="text-rose-400 font-medium group-hover:text-rose-300">
                  {price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-right text-gray-500">1</span>
                <span className="text-gray-400 truncate text-left">
                  Token #{tokenId}
                </span>
                <span className="text-right text-[10px] text-mint/80">View</span>
              </div>
            </Link>
          );
        })}

        {askRows.length > 0 && buyRows.length > 0 && (
          <div className="my-2 border-t border-gray-800/80" />
        )}

        {buyRows.length > 0 && (
          <p className="px-3 py-1 text-[10px] font-semibold text-emerald-400/90 uppercase tracking-wide">
            Buy · pool &amp; bids
          </p>
        )}
        {buyRows.map((row) => {
          if (row.kind === "pool") {
            const { bid, price } = row;
            const depth = price / maxPx;
            const mine =
              address?.toLowerCase() === bid.buyerOfferer.toLowerCase();
            return (
              <div
                key={`pool-${bid.id}`}
                className={`relative flex rounded-md overflow-hidden ${
                  isFull ? "min-h-[42px]" : ""
                }`}
              >
                <div
                  className="absolute inset-y-0 right-0 bg-emerald-500/[0.1]"
                  style={{ width: `${Math.min(100, depth * 100)}%` }}
                />
                <div className={`relative z-10 ${rowGrid}`}>
                  <span className="text-emerald-300/90 text-[10px] font-bold">
                    Buy
                  </span>
                  <span className="text-emerald-400 font-medium">
                    {price.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-right text-gray-500">1</span>
                  <span className="text-gray-400 truncate text-left">
                    Pool · {shortAddr(bid.buyerOfferer)}
                  </span>
                  <div className="flex justify-end gap-1 flex-wrap">
                    {mine && onCancelPoolBid && (
                      <button
                        type="button"
                        onClick={() => onCancelPoolBid(bid)}
                        className="text-[10px] px-2 py-0.5 rounded border border-gray-600 text-gray-400 hover:bg-gray-800"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!sellTidOk}
                      onClick={() =>
                        router.push(
                          `/marketplace/${sellTid}?sellerPoolBid=${bid.id}#pool-bids`
                        )
                      }
                      className="text-[10px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-100/90 hover:bg-amber-500/10 disabled:opacity-40"
                    >
                      Sell
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const { order, price, tokenId } = row;
          const depth = price / maxPx;
          return (
            <Link
              key={`sea-${order.orderHash}`}
              href={`/marketplace/${tokenId}`}
              className={`relative flex rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors group ${
                isFull ? "min-h-[42px]" : ""
              }`}
            >
              <div
                className="absolute inset-y-0 right-0 bg-emerald-500/[0.1]"
                style={{ width: `${Math.min(100, depth * 100)}%` }}
              />
              <div className={`relative z-10 ${rowGrid}`}>
                <span className="text-emerald-300/90 text-[10px] font-bold">Buy</span>
                <span className="text-emerald-400 font-medium group-hover:text-emerald-300">
                  {price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-right text-gray-500">1</span>
                <span className="text-gray-400 truncate text-left">
                  Seaport · #{tokenId}
                </span>
                <span className="text-right text-[10px] text-mint/80">View</span>
              </div>
            </Link>
          );
        })}

        {totalRows === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-10 px-2">
            No orders yet. Post a pool bid or list an NFT.
          </p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-800/80 bg-gray-900/40">
        <p className="text-[10px] text-gray-500 mb-1.5">
          Seller: enter your NFT # then use <strong className="text-gray-400">Sell</strong> on a
          pool row (opens your token page).
        </p>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Your token ID in this collection"
          value={sellerTokenInput}
          onChange={(e) => onSellerTokenInput(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
        />
      </div>
    </div>
  );
}
