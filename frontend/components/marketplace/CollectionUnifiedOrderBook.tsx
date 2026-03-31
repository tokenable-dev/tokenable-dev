"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

function formatPriceUsdc(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cmpAmountAsc(a: string, b: string) {
  try {
    const x = BigInt(a);
    const y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0;
  } catch {
    return a.localeCompare(b);
  }
}

function cmpAmountDesc(a: string, b: string) {
  return -cmpAmountAsc(a, b);
}

type AskRow = {
  kind: "ask";
  price: number;
  order: Order;
  tokenId: number;
};

/** Notice to potential sellers: pool bid is EIP-712 only; Seaport comes when matching. */
function buildPoolSellerNoticeText(params: {
  priceUsdc: number;
  buyerAddress: string;
  collectionLabel?: string;
  collectionPageUrl?: string;
}) {
  const col = params.collectionLabel?.trim() || "this collection";
  const urlLine = params.collectionPageUrl?.trim()
    ? `Collection page: ${params.collectionPageUrl.trim()}`
    : null;
  const lines = [
    `[Tokenable] ${col} — pool buy interest`,
    ``,
    `A buyer has registered a collection-wide pool bid at ${formatPriceUsdc(params.priceUsdc)} USDC.`,
    `This is an EIP-712 (TokenableCollectionBid) entry in our order book — it is not a Seaport on-chain order by itself.`,
    ``,
    `If you intend to sell at or near this price:`,
    `• List your NFT from My Assets, then on your asset page complete the flow so the buyer can register a Seaport bid and fulfill.`,
    ``,
    `Buyer wallet: ${params.buyerAddress}`,
    ...(urlLine ? [``, urlLine] : []),
    ``,
    `— Tokenable`,
  ];
  return lines.join("\n");
}

const poolActionIconBtn =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors " +
  "hover:bg-white/[0.06] hover:text-gray-200 focus-visible:outline focus-visible:outline-1 " +
  "focus-visible:outline-offset-1 focus-visible:outline-sky-500/40";

function PoolBidIconActions({
  copied,
  onCopy,
  onMail,
  onCancel,
}: {
  copied: boolean;
  onCopy: () => void;
  onMail: () => void;
  onCancel?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-end gap-px rounded-md border border-gray-800/70 bg-black/25 p-0.5"
      role="group"
      aria-label="Pool bid actions"
    >
      <button
        type="button"
        className={poolActionIconBtn}
        onClick={(e) => {
          e.stopPropagation();
          onCopy();
        }}
        title={copied ? "Copied" : "Copy notice for sellers"}
        aria-label={copied ? "Copied to clipboard" : "Copy seller notice"}
      >
        {copied ? (
          <svg
            className="h-3.5 w-3.5 text-emerald-400/90"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className={poolActionIconBtn}
        onClick={(e) => {
          e.stopPropagation();
          onMail();
        }}
        title="Open mail app with a draft for sellers"
        aria-label="Compose email to sellers"
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path d="m22 6-10 7L2 6" />
        </svg>
      </button>
      {onCancel && (
        <button
          type="button"
          className={`${poolActionIconBtn} hover:text-rose-300/90`}
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          title="Withdraw your pool bid"
          aria-label="Cancel pool bid"
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** 컬렉션 단일 오더북: 매도(asks) + 풀 매수(EIP-712) + Seaport 매수 */
export function CollectionUnifiedOrderBook({
  asks,
  poolBids,
  seaportBids,
  address,
  onCancelPoolBid,
  variant = "full",
  showPoolInBuySide = true,
  className = "",
  collectionLabel,
}: {
  asks: Order[];
  poolBids: BucketBid[];
  seaportBids: Order[];
  address?: string;
  onCancelPoolBid?: (bid: BucketBid) => void;
  variant?: "compact" | "full";
  showPoolInBuySide?: boolean;
  className?: string;
  collectionLabel?: string;
}) {
  const pathname = usePathname();
  const collectionPageUrl =
    typeof window !== "undefined" && pathname
      ? `${window.location.origin}${pathname}`
      : "";

  const [copiedPoolId, setCopiedPoolId] = useState<number | null>(null);
  /** ask-${amountKey} | pool-${amountKey} | sea-${amountKey} */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const copyPoolNotice = useCallback(
    async (bid: BucketBid, priceUsdc: number) => {
      const text = buildPoolSellerNoticeText({
        priceUsdc,
        buyerAddress: bid.buyerOfferer.startsWith("0x")
          ? bid.buyerOfferer
          : `0x${bid.buyerOfferer}`,
        collectionLabel,
        collectionPageUrl,
      });
      try {
        await navigator.clipboard.writeText(text);
        setCopiedPoolId(bid.id);
        window.setTimeout(() => setCopiedPoolId((id) => (id === bid.id ? null : id)), 2500);
      } catch {
        window.alert(
          "Could not copy. Here is the text:\n\n" + text.slice(0, 800) + (text.length > 800 ? "…" : "")
        );
      }
    },
    [collectionLabel, collectionPageUrl]
  );

  const openMailDraftForPool = useCallback(
    (bid: BucketBid, priceUsdc: number) => {
      const body = buildPoolSellerNoticeText({
        priceUsdc,
        buyerAddress: bid.buyerOfferer.startsWith("0x")
          ? bid.buyerOfferer
          : `0x${bid.buyerOfferer}`,
        collectionLabel,
        collectionPageUrl,
      });
      const subject = `[Tokenable] Pool bid ${formatPriceUsdc(priceUsdc)} USDC — ${collectionLabel?.trim() || "collection"}`;
      const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = url;
    },
    [collectionLabel, collectionPageUrl]
  );

  const { askGroups, buySlots, totalAskOrders, totalBuyOrders } = useMemo(() => {
    const askList: AskRow[] = [...asks]
      .sort((a, b) => cmpAmountDesc(a.considerationAmount, b.considerationAmount))
      .map((o) => ({
        kind: "ask" as const,
        price: priceUsdcOrder(o),
        order: o,
        tokenId: Number(o.tokenId),
      }));

    const askMap = new Map<string, AskRow[]>();
    for (const row of askList) {
      const k = row.order.considerationAmount;
      if (!askMap.has(k)) askMap.set(k, []);
      askMap.get(k)!.push(row);
    }
    /** Highest ask first; cheapest listing ends up at the bottom of the sell list. */
    const askGroups = [...askMap.entries()]
      .sort((a, b) => cmpAmountDesc(a[0], b[0]))
      .map(([priceKey, orders]) => ({
        priceKey,
        price: priceUsdcOrder(orders[0].order),
        orders: orders.sort((x, y) => x.tokenId - y.tokenId),
      }));

    const poolList = showPoolInBuySide
      ? poolBids.map((b) => ({
          kind: "pool" as const,
          price: priceUsdcPool(b),
          bid: b,
          amountKey: b.considerationAmount,
        }))
      : [];

    const poolMap = new Map<string, typeof poolList>();
    for (const row of poolList) {
      if (!poolMap.has(row.amountKey)) poolMap.set(row.amountKey, []);
      poolMap.get(row.amountKey)!.push(row);
    }
    const poolGroups = [...poolMap.entries()]
      .sort((a, b) => cmpAmountDesc(a[0], b[0]))
      .map(([amountKey, rows]) => ({
        kind: "pool_group" as const,
        amountKey,
        price: rows[0].price,
        bids: rows.map((r) => r.bid).sort((a, b) => a.id - b.id),
      }));

    const seaList = seaportBids.map((o) => ({
      kind: "seaport" as const,
      price: priceUsdcOrder(o),
      order: o,
      tokenId: Number(o.tokenId),
      amountKey: o.considerationAmount,
    }));

    const seaMap = new Map<string, typeof seaList>();
    for (const row of seaList) {
      if (!seaMap.has(row.amountKey)) seaMap.set(row.amountKey, []);
      seaMap.get(row.amountKey)!.push(row);
    }
    const seaGroups = [...seaMap.entries()]
      .sort((a, b) => cmpAmountDesc(a[0], b[0]))
      .map(([amountKey, rows]) => ({
        kind: "seaport_group" as const,
        amountKey,
        price: rows[0].price,
        orders: rows
          .map((r) => r.order)
          .sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
      }));

    type BuySlot =
      | (typeof poolGroups)[number]
      | (typeof seaGroups)[number];

    /** Highest bid price first; same USDC: pool rows before Seaport. */
    const buySlots: BuySlot[] = [...poolGroups, ...seaGroups].sort(
      (a, b) => b.price - a.price || (a.kind === "pool_group" ? -1 : 1)
    );

    const totalAskOrders = askList.length;
    const totalBuyOrders = poolList.length + seaList.length;

    return {
      askGroups,
      buySlots,
      totalAskOrders,
      totalBuyOrders,
    };
  }, [asks, poolBids, seaportBids, showPoolInBuySide]);

  const isFull = variant === "full";
  const shell =
    "rounded-xl border border-gray-800/80 bg-[#0b0e11] overflow-hidden flex flex-col " +
    (isFull ? "w-full max-w-none" : "max-h-[min(70vh,560px)]");

  /** Thin overlay-style scrollbar (Firefox + WebKit); track transparent so it feels light. */
  const scrollPanelClass = [
    "overflow-y-auto overscroll-contain max-h-[11rem] min-h-0 px-0 py-1.5 space-y-1 scroll-smooth rounded-md",
    "bg-black/[0.22] border border-gray-800/45",
    "[scrollbar-gutter:stable]",
    "[scrollbar-width:thin]",
    "[scrollbar-color:rgba(71,85,105,0.42)_transparent]",
    "[&::-webkit-scrollbar]:w-[5px]",
    "[&::-webkit-scrollbar-track]:bg-transparent",
    "[&::-webkit-scrollbar-thumb]:rounded-full",
    "[&::-webkit-scrollbar-thumb]:bg-slate-600/35",
    "[&::-webkit-scrollbar-thumb]:transition-colors [&::-webkit-scrollbar-thumb]:duration-200",
    "[&::-webkit-scrollbar-thumb:hover]:bg-slate-500/55",
  ].join(" ");

  const headGrid =
    "grid gap-x-3 items-center px-3 py-2.5 border-b border-gray-800/60 bg-[#080a0d] " +
    (isFull
      ? "grid-cols-[minmax(0,5rem)_minmax(5rem,1fr)_minmax(0,8.5rem)]"
      : "grid-cols-[minmax(0,4.5rem)_minmax(4.5rem,1fr)_minmax(0,7.5rem)]");

  const headLabel =
    "font-semibold text-gray-400 uppercase tracking-wide " +
    (isFull ? "text-[11px]" : "text-[10px]");

  const rowGrid =
    "grid gap-x-3 w-full font-mono tabular-nums items-center " +
    "px-3 py-1.5 min-h-[40px] " +
    (isFull
      ? "grid-cols-[minmax(0,5rem)_minmax(5rem,1fr)_minmax(0,8.5rem)] text-sm"
      : "grid-cols-[minmax(0,4.5rem)_minmax(4.5rem,1fr)_minmax(0,7.5rem)] text-[11px]");

  const displayRowCount = askGroups.length + buySlots.length;

  /** Cheapest ask — last row when sorted high → low. */
  const bestAskPriceKey =
    askGroups.length > 0 ? askGroups[askGroups.length - 1]!.priceKey : null;

  /** Highest buy — first row when sorted by price descending. */
  const bestBuyAmountKey = buySlots.length > 0 ? buySlots[0]!.amountKey : null;

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className="px-3 py-2 border-b border-gray-800/80">
        <h3
          className={`font-bold text-white tracking-wide ${isFull ? "text-sm" : "text-xs"}`}
        >
          Order book
        </h3>
      </div>

      <div className={`${headGrid} items-center`} role="row">
        <div className="min-w-0 text-left" role="columnheader">
          <span className={headLabel}>Type</span>
        </div>
        <div className="min-w-0 text-right" role="columnheader">
          <span className={headLabel}>Price</span>
        </div>
        <div className="min-w-0 text-right" role="columnheader">
          <span className={headLabel}>Action</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 gap-0 px-0 pb-2">
        {/* Sell — cheapest ask at bottom of this list */}
        <div className="pt-1.5 pb-0.5 px-3">
          <span className="text-[11px] font-semibold text-rose-400/90">Sell</span>
        </div>
        <div className={scrollPanelClass}>
        {askGroups.length === 0 ? (
          <p className="text-[11px] text-gray-600 py-3 px-3 text-center">No asks.</p>
        ) : (
        askGroups.map(({ priceKey, price, orders }) => {
          const n = orders.length;
          const key = `ask-${priceKey}`;
          const isOpen = expanded[key];
          const single = n === 1;
          const row = orders[0]!;
          const isBestAsk = priceKey === bestAskPriceKey;

          if (single) {
            return (
              <Link
                key={priceKey}
                href={`/marketplace/${row.tokenId}`}
                className={`flex rounded-md overflow-hidden transition-colors group ${
                  isFull ? "min-h-[42px]" : ""
                } ${
                  isBestAsk
                    ? "border border-rose-500/15 bg-rose-500/[0.03] hover:bg-rose-500/[0.06]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className={rowGrid}>
                  <span
                    className={`min-w-0 flex items-center text-[10px] font-bold ${
                      isBestAsk ? "text-rose-300/90" : "text-gray-500"
                    }`}
                  >
                    Sell
                  </span>
                  <span
                    className={`min-w-0 text-right font-medium tabular-nums ${
                      isBestAsk
                        ? "text-rose-400 group-hover:text-rose-300"
                        : "text-gray-200 group-hover:text-white"
                    }`}
                  >
                    {formatPriceUsdc(price)}
                  </span>
                  <span
                    className={`min-w-0 flex justify-end items-center text-[10px] ${
                      isBestAsk ? "text-mint/80" : "text-gray-500"
                    }`}
                  >
                    View
                  </span>
                </div>
              </Link>
            );
          }

          return (
            <div
              key={priceKey}
              className={`rounded-md overflow-hidden ${
                isBestAsk
                  ? "border border-rose-500/15 bg-rose-500/[0.03]"
                  : "border border-gray-800/60 bg-[#0a0a0a]/40"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                className={`flex w-full text-left rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors ${
                  isFull ? "min-h-[42px]" : ""
                }`}
              >
                <div className={rowGrid}>
                  <span
                    className={`min-w-0 flex items-center text-[10px] font-bold ${
                      isBestAsk ? "text-rose-300/90" : "text-gray-500"
                    }`}
                  >
                    Sell
                  </span>
                  <span
                    className={`min-w-0 text-right font-medium tabular-nums ${
                      isBestAsk ? "text-rose-400" : "text-gray-200"
                    }`}
                  >
                    {formatPriceUsdc(price)}
                  </span>
                  <span className="min-w-0 flex justify-end items-center text-[10px] text-gray-400 tabular-nums">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div
                  className={`border-t px-2 py-2 space-y-1 bg-black/20 ${
                    isBestAsk ? "border-rose-500/20" : "border-gray-800/80"
                  }`}
                >
                  <p className="text-[10px] text-gray-500 px-1 pb-1">
                    Same USDC — open a listing to view the card.
                  </p>
                  {orders.map(({ order, tokenId }) => (
                    <Link
                      key={order.orderHash}
                      href={`/marketplace/${tokenId}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.06] border border-transparent hover:border-gray-700/80"
                    >
                      <span className="text-gray-400 text-[11px]">Listing</span>
                      <span className="text-mint/90 text-[10px] shrink-0">View →</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })
        )}
          </div>

        <div className="border-t border-gray-800/60 pt-2 mt-2">
          {/* Buy — highest bid at top of this list */}
          <div className="pb-0.5 px-3">
            <span className="text-[11px] font-semibold text-emerald-400/90">Buy</span>
          </div>
          <div className={scrollPanelClass}>
        {buySlots.length === 0 ? (
          <p className="text-[11px] text-gray-600 py-3 px-3 text-center">No bids.</p>
        ) : (
        buySlots.map((slot) => {
          if (slot.kind === "pool_group") {
            const { amountKey, price, bids } = slot;
            const n = bids.length;
            const key = `pool-${amountKey}`;
            const isOpen = expanded[key];
            const single = n === 1;
            const bid = bids[0]!;
            const mine =
              address?.toLowerCase() === bid.buyerOfferer.toLowerCase();
            const isBestBuy = amountKey === bestBuyAmountKey;

            if (single) {
              return (
                <div
                  key={amountKey}
                  className={`flex rounded-md overflow-hidden ${
                    isFull ? "min-h-[42px]" : ""
                  } ${
                    isBestBuy
                      ? "border border-cyan-500/20 bg-cyan-500/[0.04]"
                      : "border border-gray-800/50 bg-transparent"
                  }`}
                >
                  <div className={rowGrid}>
                    <div className="min-w-0 flex flex-col gap-0.5 justify-center">
                      <span
                        className={`text-[10px] font-bold leading-tight ${
                          isBestBuy ? "text-cyan-300/90" : "text-gray-500"
                        }`}
                      >
                        Pool
                      </span>
                      <span
                        className="text-[9px] text-gray-500 font-mono truncate"
                        title={bid.buyerOfferer}
                      >
                        {shortAddr(bid.buyerOfferer)}
                      </span>
                    </div>
                    <span
                      className={`min-w-0 text-right font-medium tabular-nums self-center ${
                        isBestBuy ? "text-emerald-400" : "text-gray-200"
                      }`}
                    >
                      {formatPriceUsdc(price)}
                    </span>
                    <div className="min-w-0 flex justify-end self-center">
                      <PoolBidIconActions
                        copied={copiedPoolId === bid.id}
                        onCopy={() => void copyPoolNotice(bid, price)}
                        onMail={() => openMailDraftForPool(bid, price)}
                        onCancel={
                          mine && onCancelPoolBid
                            ? () => onCancelPoolBid(bid)
                            : undefined
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={amountKey}
                className={`rounded-md overflow-hidden ${
                  isBestBuy
                    ? "border border-cyan-500/20 bg-cyan-500/[0.04]"
                    : "border border-gray-800/60 bg-[#0a0a0a]/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className={`flex w-full text-left rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors ${
                    isFull ? "min-h-[42px]" : ""
                  }`}
                >
                  <div className={rowGrid}>
                    <span
                      className={`min-w-0 flex items-center text-[10px] font-bold ${
                        isBestBuy ? "text-cyan-300/90" : "text-gray-500"
                      }`}
                    >
                      Pool
                    </span>
                    <span
                      className={`min-w-0 text-right font-medium tabular-nums ${
                        isBestBuy ? "text-emerald-400" : "text-gray-200"
                      }`}
                    >
                      {formatPriceUsdc(price)}
                    </span>
                    <span className="min-w-0 flex justify-end items-center text-[10px] text-gray-400 tabular-nums">
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div
                    className={`border-t bg-black/20 px-2 py-2 space-y-2 ${
                      isBestBuy ? "border-cyan-500/20" : "border-gray-800/80"
                    }`}
                  >
                    {bids.map((b) => {
                      const m =
                        address?.toLowerCase() === b.buyerOfferer.toLowerCase();
                      return (
                        <div
                          key={b.id}
                          className="rounded-lg border border-gray-800/80 px-2.5 py-2 flex flex-row items-center justify-between gap-3 min-w-0"
                        >
                          <span className="text-[11px] text-gray-400 font-mono truncate min-w-0">
                            {b.buyerOfferer}
                          </span>
                          <PoolBidIconActions
                            copied={copiedPoolId === b.id}
                            onCopy={() => void copyPoolNotice(b, price)}
                            onMail={() => openMailDraftForPool(b, price)}
                            onCancel={
                              m && onCancelPoolBid
                                ? () => onCancelPoolBid(b)
                                : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const { amountKey, price, orders } = slot;
          const n = orders.length;
          const key = `sea-${amountKey}`;
          const isOpen = expanded[key];
          const single = n === 1;
          const order = orders[0]!;
          const tid = Number(order.tokenId);
          const isBestBuy = amountKey === bestBuyAmountKey;

          if (single) {
            return (
              <Link
                key={amountKey}
                href={`/marketplace/${tid}`}
                className={`flex rounded-md overflow-hidden transition-colors group ${
                  isFull ? "min-h-[42px]" : ""
                } ${
                  isBestBuy
                    ? "border border-emerald-500/15 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.05]"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className={rowGrid}>
                  <span
                    className={`min-w-0 flex items-center text-[10px] font-bold ${
                      isBestBuy ? "text-emerald-300/90" : "text-gray-500"
                    }`}
                  >
                    Bid
                  </span>
                  <span
                    className={`min-w-0 text-right font-medium tabular-nums ${
                      isBestBuy
                        ? "text-emerald-400 group-hover:text-emerald-300"
                        : "text-gray-200 group-hover:text-white"
                    }`}
                  >
                    {formatPriceUsdc(price)}
                  </span>
                  <span
                    className={`min-w-0 flex justify-end items-center text-[10px] ${
                      isBestBuy ? "text-mint/80" : "text-gray-500"
                    }`}
                  >
                    View
                  </span>
                </div>
              </Link>
            );
          }

          return (
            <div
              key={amountKey}
              className={`rounded-md overflow-hidden ${
                isBestBuy
                  ? "border border-emerald-500/15 bg-emerald-500/[0.03]"
                  : "border border-gray-800/60 bg-[#0a0a0a]/40"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                className={`flex w-full text-left rounded-md overflow-hidden hover:bg-white/[0.04] transition-colors ${
                  isFull ? "min-h-[42px]" : ""
                }`}
              >
                <div className={rowGrid}>
                  <span
                    className={`min-w-0 flex items-center text-[10px] font-bold ${
                      isBestBuy ? "text-emerald-300/90" : "text-gray-500"
                    }`}
                  >
                    Bid
                  </span>
                  <span
                    className={`min-w-0 text-right font-medium tabular-nums ${
                      isBestBuy ? "text-emerald-400" : "text-gray-200"
                    }`}
                  >
                    {formatPriceUsdc(price)}
                  </span>
                  <span className="min-w-0 flex justify-end items-center text-[10px] text-gray-400 tabular-nums">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div
                  className={`border-t bg-black/20 px-2 py-2 space-y-1 ${
                    isBestBuy ? "border-emerald-500/20" : "border-gray-800/80"
                  }`}
                >
                  <p className="text-[10px] text-gray-500 px-1 pb-1">
                    Same USDC — open a bid to view the card.
                  </p>
                  {orders.map((o) => {
                    const id = Number(o.tokenId);
                    return (
                      <Link
                        key={o.orderHash}
                        href={`/marketplace/${id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.06] border border-transparent hover:border-gray-700/80"
                      >
                        <span className="text-gray-400 text-[11px]">Bid</span>
                        <span className="text-mint/90 text-[10px] shrink-0">View →</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
        )}
          </div>

        </div>
        {displayRowCount === 0 && (
          <p className="text-[11px] text-gray-600 text-center py-6 px-2 border-t border-gray-800/70">
            No orders yet. Post a pool bid or list an asset.
          </p>
        )}
      </div>
    </div>
  );
}
