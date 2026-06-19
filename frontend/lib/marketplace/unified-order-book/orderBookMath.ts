import { formatUnits } from "viem";
import type { Order } from "@/lib/core";
import type { BookCenterModel } from "./types";

export const MAX_ORDER_BOOK_TAPE_ROWS = 50;

/** Flush collection order book — depth rows visible before wheel scroll. */
export const ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS = 3;
/** Mobile collection tab — compact bid/ask depth (best levels only). */
export const ORDER_BOOK_FLUSH_MOBILE_VISIBLE_DEPTH_ROWS = 3;
export const ORDER_BOOK_FLUSH_DEPTH_ROW_PX = 22;
export const ORDER_BOOK_FLUSH_DEPTH_GAP_PX = 1;
/** Matches bid/ask list wrapper `pt-0.5 pb-1` (2px + 4px). */
export const ORDER_BOOK_FLUSH_DEPTH_PANE_PAD_PX = 6;

export function orderBookFlushDepthPaneHeightPx(
  visibleRows = ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS,
): number {
  const rowBlock = visibleRows * ORDER_BOOK_FLUSH_DEPTH_ROW_PX;
  const gaps = Math.max(0, visibleRows - 1) * ORDER_BOOK_FLUSH_DEPTH_GAP_PX;
  return rowBlock + gaps + ORDER_BOOK_FLUSH_DEPTH_PANE_PAD_PX;
}

/** Keep in sync with {@link orderBookFlushDepthPaneHeightPx} — Tailwind needs a static class. */
export const ORDER_BOOK_FLUSH_DEPTH_PANE_HEIGHT_CLASS = "h-[74px]";
/** Keep in sync with {@link orderBookFlushDepthPaneHeightPx}(3) — mobile collection tab. */
export const ORDER_BOOK_FLUSH_MOBILE_DEPTH_PANE_HEIGHT_CLASS = "h-[74px]";

export function orderBookFlushDepthPaneHeightClass(
  visibleRows = ORDER_BOOK_FLUSH_VISIBLE_DEPTH_ROWS,
): string {
  if (visibleRows === ORDER_BOOK_FLUSH_MOBILE_VISIBLE_DEPTH_ROWS) {
    return ORDER_BOOK_FLUSH_MOBILE_DEPTH_PANE_HEIGHT_CLASS;
  }
  return ORDER_BOOK_FLUSH_DEPTH_PANE_HEIGHT_CLASS;
}

/** Flush book chrome — keep in sync with OrderBookBookTab mobile layout. */
export const ORDER_BOOK_FLUSH_COLUMN_HEADER_PX = 21;
export const ORDER_BOOK_FLUSH_CENTER_STRIP_PX = 28;
export const ORDER_BOOK_FLUSH_FOOTER_COUNTS_PX = 21;

/** Mobile collection tab body — matches flush book (header + 3 ask + center + 3 bid + footer). */
export function orderBookMobileEmbedTabBodyHeightPx(
  depthRows = ORDER_BOOK_FLUSH_MOBILE_VISIBLE_DEPTH_ROWS,
): number {
  const pane = orderBookFlushDepthPaneHeightPx(depthRows);
  return (
    ORDER_BOOK_FLUSH_COLUMN_HEADER_PX +
    pane +
    ORDER_BOOK_FLUSH_CENTER_STRIP_PX +
    pane +
    ORDER_BOOK_FLUSH_FOOTER_COUNTS_PX
  );
}

/** Keep in sync with {@link orderBookMobileEmbedTabBodyHeightPx}(3). */
export const ORDER_BOOK_MOBILE_EMBED_TAB_BODY_HEIGHT_CLASS = "h-[196px]";

export function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

export function formatOrderBookPriceUsdc(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Trades tape — whole dollars only (no cents). */
export function formatTradesTapePriceUsdc(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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

export function formatTapeDate(tSec: number): string {
  return new Date(tSec * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Full trade timestamp for tooltips (column shows date only). */
export function formatTapeTimeFull(tSec: number): string {
  return new Date(tSec * 1000).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
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
}): BookCenterModel {
  const { lastTradePriceUsdc, lastTradeSide } = input;
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

  return {
    primary: "N/A",
    tone: "none",
    lastSide: null,
    secondary: null,
    caption: "",
    title: "No on-platform sale recorded yet. Last traded price appears here after a match or purchase.",
  };
}
