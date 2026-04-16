"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits } from "viem";
import { type CollectionPlatformTapeFill, type Order } from "@/lib/api";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";

function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

function formatPriceUsdc(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cmpAskByPriceThenToken(a: Order, b: Order) {
  const pa = BigInt(a.considerationAmount);
  const pb = BigInt(b.considerationAmount);
  if (pa !== pb) return pa < pb ? -1 : 1;
  const ta = Number(a.tokenId);
  const tb = Number(b.tokenId);
  return ta - tb;
}

function cmpBidByPriceDesc(a: Order, b: Order) {
  const pa = BigInt(a.considerationAmount);
  const pb = BigInt(b.considerationAmount);
  if (pa !== pb) return pa > pb ? -1 : 1;
  return String(a.orderHash).localeCompare(String(b.orderHash));
}

/** 부동소수 오차 방지 */
function priceKey(p: number): number {
  return Math.round(p * 1_000_000) / 1_000_000;
}

function formatTapeTime(tSec: number): string {
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

const MAX_BOOK_ROWS = 12;
const MAX_TAPE_ROWS = 50;

type BookTab = "book" | "trades";

type BookCenterTone = "ask" | "bid" | "none" | "last";

type BookCenterModel = {
  primary: string;
  tone: BookCenterTone;
  /** When tone is `last`, which side initiated (for arrow / color). */
  lastSide: "buy" | "sell" | null;
  secondary: string | null;
  caption: string;
  title: string;
};

function OrderBookCenterStrip({ model }: { model: BookCenterModel }) {
  const primaryClass =
    model.tone === "none"
      ? "text-gray-500"
      : model.tone === "ask"
        ? "text-red-400"
        : model.tone === "bid"
          ? "text-emerald-400"
          : model.tone === "last" && model.lastSide === "sell"
            ? "text-rose-400"
            : "text-emerald-400";

  const showUp =
    model.tone === "bid" || (model.tone === "last" && model.lastSide === "buy");
  const showDown =
    model.tone === "ask" || (model.tone === "last" && model.lastSide === "sell");

  const hasCaption = model.caption.trim().length > 0;

  return (
    <div
      className={`relative flex shrink-0 flex-col items-center justify-center gap-1 border-y border-gray-800/90 bg-[#080a0e] px-2 py-2 sm:py-2.5 ${
        hasCaption ? "min-h-[5.5rem]" : "min-h-[4rem]"
      }`}
      title={model.title}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
        <div className="flex items-center gap-1">
          {showUp ? (
            <span className="text-base font-bold leading-none text-emerald-400/90" aria-hidden>
              ↑
            </span>
          ) : null}
          {showDown ? (
            <span className="text-base font-bold leading-none text-rose-400/90" aria-hidden>
              ↓
            </span>
          ) : null}
          <span
            className={`text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${primaryClass}`}
          >
            {model.primary}
          </span>
        </div>
        {model.secondary != null ? (
          <span className="max-w-[min(100%,220px)] truncate text-[11px] font-mono tabular-nums text-zinc-500 sm:max-w-none">
            {model.secondary}
          </span>
        ) : null}
      </div>
      {hasCaption ? (
        <p className="line-clamp-2 flex h-[2.5rem] w-full items-center justify-center px-1 text-center text-[9px] leading-snug text-zinc-600">
          {model.caption}
        </p>
      ) : null}
    </div>
  );
}

interface CollectionUnifiedOrderBookProps {
  collectionKey: string;
  asks: Order[];
  collectionBids: Order[];
  /** When user clicks a depth row, parent can map price + orders into the trade ticket. */
  onSelectLevel?: (sel: {
    side: "ask" | "bid";
    levelKey: string;
    price: number;
    orders: Order[];
  }) => void;
  /** Highlights the row that is driving the trade ticket. */
  selectedLevelKey?: string | null;
  /** Narrower layout for chart-adjacent exchange column. */
  compact?: boolean;
  /** Fused beside trade panel: no outer radius/border, fill height, scroll inside. */
  flush?: boolean;
  /** Last traded USDC price when you have fills / tape data (overrides mid-price center). */
  lastTradePriceUsdc?: number | null;
  /** Aggressor side for last trade (sets arrow direction). */
  lastTradeSide?: "buy" | "sell" | null;
  /** Fulfilled listings for this collection (newest first). */
  tapeFills?: CollectionPlatformTapeFill[];
  tapeLoading?: boolean;
}

export function CollectionUnifiedOrderBook({
  collectionKey,
  asks,
  collectionBids,
  onSelectLevel,
  selectedLevelKey,
  compact = false,
  flush = false,
  lastTradePriceUsdc = null,
  lastTradeSide = null,
  tapeFills = [],
  tapeLoading = false,
}: CollectionUnifiedOrderBookProps) {
  const [tab, setTab] = useState<BookTab>("book");

  const criteriaBids = useMemo(
    () => collectionBids.filter((b) => isCriteriaCollectionBid(b) && b.status === "active"),
    [collectionBids]
  );

  const askRows = useMemo(() => [...asks].sort(cmpAskByPriceThenToken), [asks]);
  const bidRows = useMemo(() => [...criteriaBids].sort(cmpBidByPriceDesc), [criteriaBids]);

  const askLevels = useMemo(() => {
    const byKey = new Map<number, Order[]>();
    for (const o of askRows) {
      const p = priceUsdcFromOrder(o);
      const k = priceKey(p);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(o);
    }
    const keysAsc = [...byKey.keys()].sort((a, b) => a - b);
    const raw = keysAsc.map((k) => {
      const orders = byKey.get(k)!;
      const price = priceUsdcFromOrder(orders[0]);
      const levelNotional = price * orders.length;
      return { price, orders, count: orders.length, key: `ask-${k}`, levelNotional };
    });
    const rev = [...raw].reverse().slice(0, MAX_BOOK_ROWS);
    const maxN = Math.max(...rev.map((L) => L.levelNotional), 1e-9);
    return rev.map((L) => ({
      ...L,
      depth: Math.min(1, L.levelNotional / maxN),
    }));
  }, [askRows]);

  const bidLevels = useMemo(() => {
    const slice = bidRows.slice(0, MAX_BOOK_ROWS);
    const maxCum =
      slice.reduce((acc, b) => acc + priceUsdcFromOrder(b), 0) || 1;

    const byKey = new Map<number, Order[]>();
    const sorted = [...slice].sort((a, b) => {
      const pa = priceUsdcFromOrder(a);
      const pb = priceUsdcFromOrder(b);
      if (pb !== pa) return pb - pa;
      return String(a.orderHash).localeCompare(String(b.orderHash));
    });
    for (const b of sorted) {
      const k = priceKey(priceUsdcFromOrder(b));
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(b);
    }
    const keysDesc = [...byKey.keys()].sort((a, b) => b - a);

    let cum = 0;
    return keysDesc.map((k) => {
      const orders = byKey.get(k)!;
      const price = priceUsdcFromOrder(orders[0]);
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
  }, [bidRows]);

  const bestAskPrice = useMemo(() => {
    if (!askRows.length) return null;
    return Math.min(...askRows.map((o) => priceUsdcFromOrder(o)));
  }, [askRows]);

  const bestBidPrice = useMemo(() => {
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
  }, [bidRows]);

  /**
   * Center strip: last **actual sale** when provided (`lastTradePriceUsdc`).
   * Never use bid/ask mid as “market” — that misstates the last print (e.g. ask 15 + bid 5 → not 10).
   */
  const bookCenterModel = useMemo((): BookCenterModel => {
    const fmt = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (
      lastTradePriceUsdc != null &&
      Number.isFinite(lastTradePriceUsdc) &&
      lastTradePriceUsdc > 0
    ) {
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
      return {
        primary: "N/A",
        tone: "none",
        lastSide: null,
        secondary: null,
        caption: "",
        title:
          "Last traded price appears here after a sale is recorded. The number is not an average of bid and ask.",
      };
    }

    return {
      primary: "N/A",
      tone: "none",
      lastSide: null,
      secondary: null,
      caption: "No orders",
      title: "No bid or ask in this book yet.",
    };
  }, [bestAskPrice, bestBidPrice, lastTradePriceUsdc, lastTradeSide]);

  const depthMax = compact ? "max-h-[72px]" : "max-h-[100px]";
  const depthClass = flush
    ? "min-h-[40px] max-h-none overflow-visible"
    : `overflow-y-auto scrollbar-platform ${depthMax}`;

  const shell = flush
    ? "relative flex h-full max-h-full min-h-0 max-w-full max-xl:min-h-[min(200px,28dvh)] flex-col overflow-hidden rounded-none border-0 bg-[#0c0e12] shadow-none xl:min-h-0"
    : `relative overflow-hidden border border-zinc-800/90 bg-[#0c0e12] ${
        compact
          ? "rounded-xl shadow-none"
          : "rounded-2xl shadow-[0_16px_48px_-20px_rgba(0,0,0,0.75)]"
      }`;

  return (
    <div className={shell} aria-label={`Order book ${collectionKey}`}>
      {!compact && !flush && (
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-52 rounded-full bg-emerald-500/[0.12] blur-3xl"
          aria-hidden
        />
      )}
      <div
        className={`relative shrink-0 border-b border-gray-800/80 px-2.5 pt-2.5 pb-1.5 sm:px-3 flex items-end justify-between gap-2`}
      >
        <h2 className="text-sm font-bold text-white tracking-tight">Order Book</h2>
        <div className="flex rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
          <button
            type="button"
            onClick={() => setTab("book")}
            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === "book"
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Book
          </button>
          <button
            type="button"
            onClick={() => setTab("trades")}
            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === "trades"
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Trades
          </button>
        </div>
      </div>

      {tab === "book" &&
        (flush ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
            <div className="relative grid shrink-0 grid-cols-[1fr_44px] gap-1.5 border-b border-gray-800/80 px-2.5 py-1.5 text-[9px] font-medium text-gray-500 sm:px-3">
              <span>Price (USDC)</span>
              <span className="text-right tabular-nums">Count</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-platform">
              <div className="flex min-h-full flex-col justify-end gap-px px-1 pt-0.5 pb-0.5">
                {askLevels.length === 0 ? (
                  <div className="py-3 text-center text-[10px] text-gray-600">No sell orders</div>
                ) : (
                  askLevels.map((level) => (
                    <button
                      key={level.key}
                      type="button"
                      onClick={() =>
                        onSelectLevel?.({
                          side: "ask",
                          levelKey: level.key,
                          price: level.price,
                          orders: level.orders,
                        })
                      }
                      className={`relative flex min-h-[24px] w-full cursor-pointer items-center overflow-hidden rounded-[2px] text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/40 ${
                        selectedLevelKey === level.key
                          ? "bg-white/[0.06] ring-1 ring-rose-500/50"
                          : ""
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600/35 to-rose-600/[0.07] transition-[width]"
                        style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                      />
                      <div className="pointer-events-none relative z-10 grid w-full grid-cols-[1fr_44px] items-center gap-1.5 px-2 py-1 font-mono text-[11px] tabular-nums leading-none">
                        <span className="font-medium text-red-300/95">
                          {formatPriceUsdc(level.price)}
                        </span>
                        <span className="text-right text-gray-200/90">{level.count}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="relative mx-0.5 shrink-0">
              <OrderBookCenterStrip model={bookCenterModel} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-platform">
              <div className="flex flex-col gap-px px-1 py-0.5 pb-1.5">
                {bidLevels.length === 0 ? (
                  <div className="py-3 text-center text-[10px] text-gray-600">No buy orders</div>
                ) : (
                  bidLevels.map((level) => (
                    <button
                      key={level.key}
                      type="button"
                      onClick={() =>
                        onSelectLevel?.({
                          side: "bid",
                          levelKey: level.key,
                          price: level.price,
                          orders: level.orders,
                        })
                      }
                      className={`relative flex min-h-[24px] w-full cursor-pointer items-center overflow-hidden rounded-[2px] text-left transition-colors hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/40 ${
                        selectedLevelKey === level.key
                          ? "bg-white/[0.06] ring-1 ring-emerald-500/50"
                          : ""
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/35 to-emerald-600/[0.07] transition-[width]"
                        style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                      />
                      <div className="pointer-events-none relative z-10 grid w-full grid-cols-[1fr_44px] items-center gap-1.5 px-2 py-1 font-mono text-[11px] tabular-nums leading-none">
                        <span className="font-medium text-emerald-300/95">
                          {formatPriceUsdc(level.price)}
                        </span>
                        <span className="text-right text-gray-200/90">{level.count}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="shrink-0 space-y-1 border-t border-gray-800/80 px-2.5 py-1.5">
              <div className="flex justify-between gap-2 font-mono text-[9px] tabular-nums text-gray-600">
                <span>
                  Bids <span className="text-emerald-500/80">{bidRows.length}</span>
                </span>
                <span>
                  Asks <span className="text-rose-400/80">{askRows.length}</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative grid grid-cols-[1fr_44px] gap-1.5 px-2.5 sm:px-3 py-1.5 text-[9px] font-medium text-gray-500 border-b border-gray-800/80">
              <span>Price (USDC)</span>
              <span className="text-right tabular-nums">Count</span>
            </div>

            <div
              className={`min-h-[36px] flex flex-col justify-end gap-px px-1 pt-0.5 overflow-y-auto scrollbar-platform ${depthMax}`}
            >
              {askLevels.length === 0 ? (
                <div className="py-3 text-center text-[10px] text-gray-600">No sell orders</div>
              ) : (
                askLevels.map((level) => (
                  <button
                    key={level.key}
                    type="button"
                    onClick={() =>
                      onSelectLevel?.({
                        side: "ask",
                        levelKey: level.key,
                        price: level.price,
                        orders: level.orders,
                      })
                    }
                    className={`relative min-h-[24px] w-full text-left flex items-center rounded-[2px] overflow-hidden transition-colors cursor-pointer hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/40 ${
                      selectedLevelKey === level.key ? "ring-1 ring-rose-500/50 bg-white/[0.06]" : ""
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-gradient-to-l from-rose-600/35 to-rose-600/[0.07] transition-[width]"
                      style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                    />
                    <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1.5 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center leading-none pointer-events-none">
                      <span className="text-red-300/95 font-medium">{formatPriceUsdc(level.price)}</span>
                      <span className="text-right text-gray-200/90">{level.count}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="relative mx-0.5 my-0.5">
              <OrderBookCenterStrip model={bookCenterModel} />
            </div>

            <div className={`${depthMax} overflow-y-auto scrollbar-platform flex flex-col gap-px px-1 pb-1.5`}>
              {bidLevels.length === 0 ? (
                <div className="py-3 text-center text-[10px] text-gray-600">No buy orders</div>
              ) : (
                bidLevels.map((level) => (
                  <button
                    key={level.key}
                    type="button"
                    onClick={() =>
                      onSelectLevel?.({
                        side: "bid",
                        levelKey: level.key,
                        price: level.price,
                        orders: level.orders,
                      })
                    }
                    className={`relative min-h-[24px] w-full text-left flex items-center rounded-[2px] overflow-hidden transition-colors cursor-pointer hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/40 ${
                      selectedLevelKey === level.key ? "ring-1 ring-emerald-500/50 bg-white/[0.06]" : ""
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600/35 to-emerald-600/[0.07] transition-[width]"
                      style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                    />
                    <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1.5 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center leading-none pointer-events-none">
                      <span className="text-emerald-300/95 font-medium">
                        {formatPriceUsdc(level.price)}
                      </span>
                      <span className="text-right text-gray-200/90">{level.count}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-gray-800/80 px-2.5 py-1.5 space-y-1">
              <div className="flex justify-between gap-2 text-[9px] font-mono text-gray-600 tabular-nums">
                <span>
                  Bids <span className="text-emerald-500/80">{bidRows.length}</span>
                </span>
                <span>
                  Asks <span className="text-rose-400/80">{askRows.length}</span>
                </span>
              </div>
              {bidRows.length > 0 && !compact && (
                <p className="text-[9px] leading-snug text-gray-600">
                  Selling: use the <span className="text-gray-400">Sell</span> tab or list from your asset;
                  crossing bids fill automatically when you list at or below a collection bid.
                </p>
              )}
            </div>
          </>
        ))}

      {tab === "trades" && (
        <div
          className={`flex min-h-0 flex-col ${
            flush ? "min-h-0 flex-1 overflow-hidden" : "max-h-[min(420px,52vh)]"
          }`}
        >
          {tapeLoading ? (
            <div className="flex flex-1 items-center justify-center py-12 text-[11px] text-gray-500">
              Loading trades…
            </div>
          ) : tapeFills.length === 0 ? (
            <div className="px-3 py-10 text-center text-[11px] leading-relaxed text-gray-600">
              No on-chain sales recorded for this collection yet.
            </div>
          ) : (
            <>
              <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_44px_minmax(0,52px)_minmax(0,1fr)] gap-1 border-b border-gray-800/80 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 sm:px-3 sm:text-[10px]">
                <span>Price</span>
                <span className="text-center">Side</span>
                <span className="text-right">Token</span>
                <span className="text-right">Time</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-platform px-1 py-0.5">
                {tapeFills.slice(0, MAX_TAPE_ROWS).map((row) => (
                  <div
                    key={row.orderHash}
                    className="grid grid-cols-[minmax(0,1fr)_44px_minmax(0,52px)_minmax(0,1fr)] items-center gap-1 rounded-[2px] px-1.5 py-1 font-mono text-[10px] tabular-nums text-gray-200 hover:bg-white/[0.03] sm:text-[11px]"
                  >
                    <span className="min-w-0 truncate text-emerald-400/95">
                      {row.priceUsdc.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span
                      className={`text-center text-[9px] font-sans font-medium uppercase tracking-wide sm:text-[10px] ${
                        row.tapeAggressor === "sell"
                          ? "text-rose-400/95"
                          : "text-emerald-500/90"
                      }`}
                    >
                      {row.tapeAggressor === "sell" ? "Sell" : "Buy"}
                    </span>
                    <span className="text-right">
                      <Link
                        href={`/marketplace/${encodeURIComponent(row.tokenId)}`}
                        className="text-mint/90 hover:text-mint hover:underline"
                      >
                        #{row.tokenId}
                      </Link>
                    </span>
                    <span className="min-w-0 truncate text-right text-gray-500" title={new Date(row.t * 1000).toISOString()}>
                      {formatTapeTime(row.t)}
                    </span>
                  </div>
                ))}
              </div>
              {tapeFills.length > MAX_TAPE_ROWS ? (
                <p className="shrink-0 border-t border-gray-800/70 px-2.5 py-1 text-center text-[9px] text-gray-600">
                  Showing last {MAX_TAPE_ROWS} of {tapeFills.length} fills
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
