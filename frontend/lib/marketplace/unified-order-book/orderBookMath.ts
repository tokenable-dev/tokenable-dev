import { formatUnits } from "viem";
import type { Order } from "@/lib/core";
import type { BookCenterModel } from "./types";

export const MAX_ORDER_BOOK_TAPE_ROWS = 50;

export function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

export function formatOrderBookPriceUsdc(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSpreadPrimary(bestAsk: number | null, bestBid: number | null): string | null {
  if (
    bestAsk == null ||
    bestBid == null ||
    !Number.isFinite(bestAsk) ||
    !Number.isFinite(bestBid) ||
    bestAsk <= 0 ||
    bestBid <= 0
  ) {
    return null;
  }
  const spread = Math.abs(bestAsk - bestBid);
  const mid = (bestAsk + bestBid) / 2;
  if (!(mid > 0)) return null;
  const pct = (spread / mid) * 100;
  const pctStr = pct < 0.1 ? pct.toFixed(3) : pct.toFixed(2);
  return `Spread value: ${formatOrderBookPriceUsdc(spread)} (${pctStr}%)`;
}

export function cmpAskByPriceThenToken(a: Order, b: Order): number {
  const pa = BigInt(a.considerationAmount);
  const pb = BigInt(b.considerationAmount);
  if (pa !== pb) return pa < pb ? -1 : 1;
  return Number(a.tokenId) - Number(b.tokenId);
}

export function cmpBidByPriceDesc(a: Order, b: Order): number {
  const pa = BigInt(a.considerationAmount);
  const pb = BigInt(b.considerationAmount);
  if (pa !== pb) return pa > pb ? -1 : 1;
  return String(a.orderHash).localeCompare(String(b.orderHash));
}

export function priceLevelKey(p: number): number {
  return Math.round(p * 1_000_000) / 1_000_000;
}

export function formatTapeTime(tSec: number): string {
  const d = new Date(tSec * 1000);
  const diff = Date.now() - d.getTime();
  if (diff < 90_000) return "Just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export type OrderBookDepthLevel = {
  price: number;
  orders: Order[];
  count: number;
  key: string;
  depth: number;
};

export function buildAskDepthLevels(askRows: Order[]): OrderBookDepthLevel[] {
  const byKey = new Map<number, Order[]>();
  for (const o of askRows) {
    const p = priceUsdcFromOrder(o);
    const k = priceLevelKey(p);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(o);
  }
  const keysAsc = [...byKey.keys()].sort((a, b) => a - b);
  const raw = keysAsc.map((k) => {
    const orders = byKey.get(k)!;
    const price = priceUsdcFromOrder(orders[0]!);
    const levelNotional = price * orders.length;
    return { price, orders, count: orders.length, key: `ask-${k}`, levelNotional };
  });
  const rev = [...raw].reverse();
  const maxN = Math.max(...rev.map((L) => L.levelNotional), 1e-9);
  return rev.map((L) => ({
    price: L.price,
    orders: L.orders,
    count: L.count,
    key: L.key,
    depth: Math.min(1, L.levelNotional / maxN),
  }));
}

export function buildBidDepthLevels(bidRows: Order[]): OrderBookDepthLevel[] {
  const maxCum = bidRows.reduce((acc, b) => acc + priceUsdcFromOrder(b), 0) || 1;
  const byKey = new Map<number, Order[]>();
  const sorted = [...bidRows].sort((a, b) => {
    const pa = priceUsdcFromOrder(a);
    const pb = priceUsdcFromOrder(b);
    if (pb !== pa) return pb - pa;
    return String(a.orderHash).localeCompare(String(b.orderHash));
  });
  for (const b of sorted) {
    const k = priceLevelKey(priceUsdcFromOrder(b));
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(b);
  }
  const keysDesc = [...byKey.keys()].sort((a, b) => b - a);
  let cum = 0;
  return keysDesc.map((k) => {
    const orders = byKey.get(k)!;
    const price = priceUsdcFromOrder(orders[0]!);
    const levelSum = price * orders.length;
    cum += levelSum;
    return {
      price,
      orders,
      count: orders.length,
      depth: cum / maxCum,
      key: `bid-${k}-${orders.map((o) => o.orderHash).join("|")}`,
    };
  });
}

export function bestAskFromRows(askRows: Order[]): number | null {
  if (!askRows.length) return null;
  return Math.min(...askRows.map((o) => priceUsdcFromOrder(o)));
}

export function bestBidFromRows(bidRows: Order[]): number | null {
  if (!bidRows.length) return null;
  let max = -Infinity;
  for (const b of bidRows) {
    let display = priceUsdcFromOrder(b);
    try {
      const offer0 = b.parameters?.offer?.[0];
      if (offer0?.startAmount) display = Number(formatUnits(BigInt(offer0.startAmount), 6));
    } catch {
      /* keep */
    }
    if (display > max) max = display;
  }
  return Number.isFinite(max) && max > 0 ? max : null;
}

export function buildOrderBookCenterModel(input: {
  lastTradePriceUsdc: number | null | undefined;
  lastTradeSide: "buy" | "sell" | null | undefined;
  bestAskPrice: number | null;
  bestBidPrice: number | null;
}): BookCenterModel {
  const { lastTradePriceUsdc, lastTradeSide, bestAskPrice, bestBidPrice } = input;
  const fmt = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (lastTradePriceUsdc != null && Number.isFinite(lastTradePriceUsdc) && lastTradePriceUsdc > 0) {
    return {
      primary: fmt(lastTradePriceUsdc),
      tone: "last",
      lastSide: lastTradeSide ?? null,
      secondary: null,
      caption: "",
      title: "Most recent on-platform purchase price (USDC).",
    };
  }

  if (bestAskPrice != null || bestBidPrice != null) {
    const spreadLine = formatSpreadPrimary(bestAskPrice, bestBidPrice);
    return {
      primary: spreadLine ?? "N/A",
      tone: "none",
      lastSide: null,
      secondary: null,
      caption: "",
      title: spreadLine
        ? "Bid–ask spread (absolute USDC and percent of mid). Last traded price appears here after a sale is recorded."
        : "Last traded price appears here after a sale is recorded. Spread needs both a bid and an ask.",
    };
  }

  return {
    primary: "N/A",
    tone: "none",
    lastSide: null,
    secondary: null,
    caption: "",
    title: "No bid or ask in this book yet.",
  };
}
