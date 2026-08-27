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

/** USDC book prices — keep cents (7.1 stays 7.1, not 7). */
export function formatOrderBookUsdAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Card.html order-book Price column. */
export function formatCollectionDetailBookPriceUsdc(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${formatOrderBookUsdAmount(n)}`;
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
    day: "2-digit",
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
  /** Qty at this price level. */
  count: number;
  /** Notional USDC at this level = price × qty. */
  total: number;
  key: string;
  /** Depth bar = level total ÷ side max total (notional). */
  depth: number;
  /** @deprecated Collection detail no longer shows Vault; kept for callers. */
  vaultLabel?: string | null;
};

/**
 * Total = price × qty; depth bar = that notional ÷ side max notional.
 * Ask levels high→low; bid levels high→low (best first for bids).
 */
export function applyOrderBookNotionalDepth(
  askLevels: OrderBookDepthLevel[],
  bidLevels: OrderBookDepthLevel[],
): { askLevels: OrderBookDepthLevel[]; bidLevels: OrderBookDepthLevel[] } {
  const withNotional = (levels: OrderBookDepthLevel[]) => {
    const next = levels.map((l) => ({
      ...l,
      total: l.price * l.count,
    }));
    const max = Math.max(1, ...next.map((l) => l.total), 0);
    return next.map((l) => ({ ...l, depth: l.total / max }));
  };
  return {
    askLevels: withNotional(askLevels),
    bidLevels: withNotional(bidLevels),
  };
}

/** @deprecated Use {@link applyOrderBookNotionalDepth}. */
export const applyOrderBookCumulativeDepth = applyOrderBookNotionalDepth;
/** @deprecated Use {@link applyOrderBookNotionalDepth}. */
export const applyOrderBookQuantityDepth = applyOrderBookNotionalDepth;

/** Order-book Total column — `$999` or `$1.2k` / `$3.4m` / `$1.1b`. */
export function formatOrderBookTotalUsdc(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const abs = Math.abs(n);
  if (abs < 1000) {
    return `$${formatOrderBookUsdAmount(abs)}`;
  }
  const trim = (v: number) => {
    const s = v >= 100 ? v.toFixed(0) : v.toFixed(1);
    return s.replace(/\.0$/, "");
  };
  if (abs >= 1_000_000_000) return `$${trim(abs / 1_000_000_000)}b`;
  if (abs >= 1_000_000) return `$${trim(abs / 1_000_000)}m`;
  return `$${trim(abs / 1000)}k`;
}

export function buildAskDepthLevels(askRows: Order[]): OrderBookDepthLevel[] {
  const byKey = new Map<number, Order[]>();
  for (const o of askRows) {
    const p = priceUsdcFromOrder(o);
    const k = priceLevelKey(p);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(o);
  }
  const keysAsc = [...byKey.keys()].sort((a, b) => a - b);
  const bestFirst = keysAsc.map((k) => {
    const orders = byKey.get(k)!;
    const price = priceUsdcFromOrder(orders[0]!);
    const count = orders.length;
    return {
      price,
      orders,
      count,
      total: price * count,
      key: `ask-${k}`,
    };
  });
  const askMax = Math.max(1, ...bestFirst.map((l) => l.total), 0);
  return [...bestFirst].reverse().map((L) => ({
    ...L,
    depth: L.total / askMax,
  }));
}

export function buildBidDepthLevels(bidRows: Order[]): OrderBookDepthLevel[] {
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
  const levels = keysDesc.map((k) => {
    const orders = byKey.get(k)!;
    const price = priceUsdcFromOrder(orders[0]!);
    const count = orders.length;
    return {
      price,
      orders,
      count,
      total: price * count,
      key: `bid-${k}-${orders.map((o) => o.orderHash).join("|")}`,
    };
  });
  const bidMax = Math.max(1, ...levels.map((l) => l.total), 0);
  return levels.map((l) => ({
    ...l,
    depth: l.total / bidMax,
  }));
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
  bestAskUsdc?: number | null;
  bestBidUsdc?: number | null;
}): BookCenterModel {
  const { lastTradePriceUsdc, lastTradeSide, bestAskUsdc, bestBidUsdc } = input;
  const fmtUsd = (n: number) => formatOrderBookUsdAmount(n);

  const spreadSecondary =
    bestAskUsdc != null &&
    bestBidUsdc != null &&
    Number.isFinite(bestAskUsdc) &&
    Number.isFinite(bestBidUsdc) &&
    bestAskUsdc > bestBidUsdc
      ? `Spread $${fmtUsd(bestAskUsdc - bestBidUsdc)}`
      : bestAskUsdc != null || bestBidUsdc != null
        ? "No live spread"
        : null;

  if (lastTradePriceUsdc != null && Number.isFinite(lastTradePriceUsdc) && lastTradePriceUsdc > 0) {
    return {
      primary: fmtUsd(lastTradePriceUsdc),
      tone: "last",
      lastSide: lastTradeSide ?? null,
      secondary: spreadSecondary,
      caption: "",
      title: "Most recent on-platform purchase price (USDC).",
    };
  }

  return {
    primary: "N/A",
    tone: "none",
    lastSide: null,
    secondary: spreadSecondary,
    caption: "",
    title: "No on-platform sale recorded yet. Last traded price appears here after a match or purchase.",
  };
}
