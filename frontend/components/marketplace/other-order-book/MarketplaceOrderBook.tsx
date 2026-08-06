"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Order, OrderListItem } from "@/lib/core";

export type OrderBookRow = Order | OrderListItem;

function priceUsdc(o: OrderBookRow): number {
  if ("considerationAmount" in o && o.considerationAmount != null) {
    return Number(o.considerationAmount) / 1_000_000;
  }
  return Number((o as OrderListItem).price) / 1_000_000;
}

/** 마켓플레이스 — 매도(ask) 호가를 거래소 식으로 나열 */
export function MarketplaceOrderBook({
  orders,
  subtitle = "All listings (ask)",
  /** compact = 사이드바용 좁은 폭 · full = 컬렉션 상세 등 메인 호가창 */
  variant = "compact",
  className = "",
}: {
  orders: OrderBookRow[];
  subtitle?: string;
  variant?: "compact" | "full";
  className?: string;
}) {
  const rows = useMemo(() => {
    return [...orders]
      .sort((a, b) => priceUsdc(a) - priceUsdc(b))
      .map((o) => ({
        order: o,
        price: priceUsdc(o),
        tokenId: Number(o.tokenId),
      }));
  }, [orders]);

  const maxPrice = useMemo(() => {
    return rows.length ? Math.max(...rows.map((r) => r.price), 1e-9) : 1;
  }, [rows]);

  const isFull = variant === "full";
  const shell =
    "rounded-xl border border-gray-800 bg-[#0b0e11] overflow-hidden flex flex-col " +
    (isFull
      ? "w-full max-w-4xl max-h-[min(85vh,720px)] shadow-lg shadow-black/40"
      : "max-h-[min(70vh,560px)]");

  const headRow =
    "grid gap-2 px-3 py-2 font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800/80 " +
    (isFull
      ? "grid-cols-[1fr_64px_80px] text-xs"
      : "grid-cols-[1fr_48px_56px] px-2 py-1.5 text-[10px]");

  const rowGrid =
    "grid gap-2 w-full px-3 font-mono tabular-nums " +
    (isFull
      ? "grid-cols-[1fr_64px_80px] text-sm min-h-[44px] items-center"
      : "grid-cols-[1fr_48px_56px] px-2 text-xs min-h-[36px]");

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="px-4 py-3 border-b border-gray-800/90 flex items-center justify-between gap-2">
        <div>
          <h3 className={`font-bold text-white tracking-wide ${isFull ? "text-sm" : "text-xs"}`}>
            Order book
          </h3>
          <p className={`text-gray-500 mt-0.5 ${isFull ? "text-xs" : "text-[10px]"}`}>
            {subtitle}
          </p>
        </div>
        <span className={`font-mono text-gray-500 ${isFull ? "text-xs" : "text-[10px]"}`}>
          {rows.length} orders
        </span>
      </div>
      <div className={headRow}>
        <span>Price (USDC)</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Token</span>
      </div>
      <div
        className={`overflow-y-auto overscroll-y-auto flex-1 py-1 space-y-px min-h-[120px] ${isFull ? "px-1" : "px-1"}`}
      >
        {rows.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8 px-2">No orders</p>
        ) : (
          rows.map(({ order, price, tokenId }) => {
            const depth = price / maxPrice;
            return (
              <Link
                key={order.orderHash}
                href={`/marketplace/${tokenId}`}
                className={`relative flex items-center rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors group ${
                  isFull ? "min-h-[44px]" : ""
                }`}
              >
                <div
                  className="absolute inset-y-0 right-0 bg-rose-500/[0.12]"
                  style={{ width: `${Math.min(100, depth * 100)}%` }}
                />
                <div className={`relative z-10 ${rowGrid}`}>
                  <span className="text-rose-400 font-medium group-hover:text-rose-300">
                    {price.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-right text-gray-400">1</span>
                  <span className="text-right text-gray-400 group-hover:text-mint/90">
                    #{tokenId}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
