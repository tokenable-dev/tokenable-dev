"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Order } from "@/lib/api";

function priceUsdc(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

/** 마켓플레이스 탭 — 전체 매도(ask) 호가를 거래소 식으로 나열 */
export function MarketplaceOrderBook({ orders }: { orders: Order[] }) {
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

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b0e11] overflow-hidden flex flex-col max-h-[min(70vh,560px)]">
      <div className="px-3 py-2.5 border-b border-gray-800/90 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-white tracking-wide">Order book</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">All listings (ask)</p>
        </div>
        <span className="text-[10px] font-mono text-gray-500">{rows.length} orders</span>
      </div>
      <div className="grid grid-cols-[1fr_48px_56px] gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800/80">
        <span>Price (USDC)</span>
        <span className="text-right">Qty</span>
        <span className="text-right">ID</span>
      </div>
      <div className="overflow-y-auto flex-1 py-1 px-1 space-y-px min-h-[120px]">
        {rows.length === 0 ? (
          <p className="text-[11px] text-gray-600 text-center py-8 px-2">No orders</p>
        ) : (
        rows.map(({ order, price, tokenId }) => {
          const depth = price / maxPrice;
          return (
            <Link
              key={order.orderHash}
              href={`/marketplace/${tokenId}`}
              className="relative flex items-center min-h-[30px] rounded-sm overflow-hidden hover:bg-white/[0.04] transition-colors group"
            >
              <div
                className="absolute inset-y-0 right-0 bg-rose-500/[0.1]"
                style={{ width: `${Math.min(100, depth * 100)}%` }}
              />
              <div className="relative z-10 grid grid-cols-[1fr_48px_56px] gap-1 w-full px-2 text-[11px] font-mono tabular-nums">
                <span className="text-rose-400 font-medium group-hover:text-rose-300">
                  {price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-right text-gray-400">1</span>
                <span className="text-right text-gray-500">#{tokenId}</span>
              </div>
            </Link>
          );
        })
        )}
      </div>
    </div>
  );
}
