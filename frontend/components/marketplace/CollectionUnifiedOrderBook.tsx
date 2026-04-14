"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits, type Address } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { cancelOrder, type Order } from "@/lib/api";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import { bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";
import { submitAskListingOrder } from "@/lib/seaport/submitAskListing";

function priceUsdcFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 1_000_000;
}

function formatPriceUsdc(n: number) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Bid offerer in lists — same price may have multiple buyers; sellers need to see who each bid is from. */
function shortOfferer(addr: string) {
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
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

const MAX_BOOK_ROWS = 12;

type BookTab = "book" | "trades";

interface CollectionUnifiedOrderBookProps {
  collectionKey: string;
  asks: Order[];
  collectionBids: Order[];
  address?: string;
  onInvalidate?: () => void;
  /** When user clicks a depth row, parent can map price + orders into the trade ticket. */
  onSelectLevel?: (sel: {
    side: "ask" | "bid";
    levelKey: string;
    price: number;
    orders: Order[];
  }) => void;
  /** Highlights the row that is driving the trade ticket. */
  selectedLevelKey?: string | null;
}

export function CollectionUnifiedOrderBook({
  collectionKey,
  asks,
  collectionBids,
  address: addressProp,
  onInvalidate,
  onSelectLevel,
  selectedLevelKey,
}: CollectionUnifiedOrderBookProps) {
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [instantBusy, setInstantBusy] = useState<string | null>(null);
  const [instantErr, setInstantErr] = useState<string | null>(null);
  const [pickToken, setPickToken] = useState<number | null>(null);
  const [instantBidHash, setInstantBidHash] = useState<string | null>(null);
  const [instantModalOpen, setInstantModalOpen] = useState(false);
  const [tab, setTab] = useState<BookTab>("book");

  const { address: wagmiAddr } = useAccount();
  const address = addressProp ?? wagmiAddr;

  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

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

  /** Center strip: best ask (buyers’ reference) vs best bid — matches “last / reference price” row in pro OB UIs */
  const bookCenterDisplay = useMemo(() => {
    const fmt = (n: number) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (bestAskPrice != null && bestBidPrice != null) {
      return {
        primary: fmt(bestAskPrice),
        primaryTone: "ask" as const,
        secondary: fmt(bestBidPrice),
        caption: `Spread ${fmt(bestAskPrice - bestBidPrice)} USDC`,
      };
    }
    if (bestAskPrice != null) {
      return {
        primary: fmt(bestAskPrice),
        primaryTone: "ask" as const,
        secondary: null as string | null,
        caption: "Best ask (floor)",
      };
    }
    if (bestBidPrice != null) {
      return {
        primary: fmt(bestBidPrice),
        primaryTone: "bid" as const,
        secondary: null as string | null,
        caption: "Best collection bid",
      };
    }
    return {
      primary: "—",
      primaryTone: "none" as const,
      secondary: null as string | null,
      caption: "No orders",
    };
  }, [bestAskPrice, bestBidPrice]);

  const myAsks = useMemo(() => {
    if (!address) return [];
    const a = address.toLowerCase();
    return askRows.filter((o) => {
      const raw = String(o.tokenId ?? "").trim();
      const tid = Number(raw);
      return (
        o.status === "active" &&
        (o.side === "ask" || o.side == null) &&
        o.offerer.toLowerCase() === a &&
        raw !== "" &&
        Number.isFinite(tid) &&
        tid >= 0
      );
    });
  }, [askRows, address]);

  const myBids = useMemo(() => {
    if (!address) return [];
    const a = address.toLowerCase();
    return criteriaBids.filter((b) => b.offerer.toLowerCase() === a);
  }, [criteriaBids, address]);

  const displayBidUsdc = (o: Order) => {
    let display = priceUsdcFromOrder(o);
    try {
      const offer0 = o.parameters?.offer?.[0];
      if (offer0?.startAmount) display = Number(formatUnits(BigInt(offer0.startAmount), 6));
    } catch {
      /* */
    }
    return display;
  };

  useEffect(() => {
    if (bidRows.length === 0) {
      setInstantBidHash(null);
      return;
    }
    setInstantBidHash((prev) =>
      prev != null && bidRows.some((b) => b.orderHash === prev) ? prev : bidRows[0].orderHash
    );
  }, [bidRows]);

  const selectedInstantBid = useMemo(() => {
    if (bidRows.length === 0) return null;
    if (instantBidHash != null) {
      const hit = bidRows.find((b) => b.orderHash === instantBidHash);
      if (hit) return hit;
    }
    return bidRows[0];
  }, [bidRows, instantBidHash]);

  useEffect(() => {
    if (myAsks.length === 0) {
      setPickToken(null);
      return;
    }
    if (pickToken === null || !myAsks.some((o) => Number(o.tokenId) === pickToken)) {
      setPickToken(Number(myAsks[0].tokenId));
    }
  }, [myAsks, pickToken]);

  const selectedAsk = useMemo(() => {
    if (pickToken == null) return myAsks[0] ?? null;
    return myAsks.find((o) => Number(o.tokenId) === pickToken) ?? myAsks[0] ?? null;
  }, [myAsks, pickToken]);

  /** Instant sell 미리보기 — 리스팅가 vs 입찰가(리프라이스 필요 여부) */
  const instantMatchPreview = useMemo(() => {
    if (!selectedAsk || !selectedInstantBid) return null;
    let bidUsdc = priceUsdcFromOrder(selectedInstantBid);
    try {
      const offer0 = selectedInstantBid.parameters?.offer?.[0];
      if (offer0?.startAmount)
        bidUsdc = Number(formatUnits(BigInt(offer0.startAmount), 6));
    } catch {
      /* */
    }
    try {
      const askAm = BigInt(selectedAsk.considerationAmount);
      const bidAm = bidUsdcAmount(selectedInstantBid);
      return {
        listingUsdc: priceUsdcFromOrder(selectedAsk),
        bidUsdc,
        needsReprice: askAm > bidAm,
      };
    } catch {
      return {
        listingUsdc: priceUsdcFromOrder(selectedAsk),
        bidUsdc,
        needsReprice: false,
      };
    }
  }, [selectedAsk, selectedInstantBid]);

  async function handleCancelBid(o: Order) {
    if (!address) return;
    setCancelling(o.orderHash);
    try {
      await cancelOrder(o.orderHash, address);
      onInvalidate?.();
    } finally {
      setCancelling(null);
    }
  }

  async function handleInstantSell(bid: Order) {
    setInstantErr(null);
    if (!address || !publicClient || !walletClient || !selectedAsk) {
      setInstantErr("Connect your wallet and ensure you have a listing in this collection.");
      return;
    }

    const bidAm = bidUsdcAmount(bid);
    const askAm = BigInt(selectedAsk.considerationAmount);
    const listingTokenId = selectedAsk.tokenId;

    setInstantBusy(bid.orderHash);
    try {
      let listing = selectedAsk;
      if (askAm > bidAm) {
        listing = await submitAskListingOrder({
          tokenId: listingTokenId,
          priceUsdc: formatUnits(bidAm, 6),
          address: address as Address,
          publicClient,
          walletClient,
          writeContractAsync: writeContractAsync as Parameters<
            typeof submitAskListingOrder
          >[0]["writeContractAsync"],
          mode: "replace",
          oldOrderHash: selectedAsk.orderHash,
        });
      }

      const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
        writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0]
        )) as MatchWriteContractAsync;

      await runCriteriaMatch({
        address: address as Address,
        publicClient,
        writeContractAsync: matchWrite,
        bid,
        listing,
        tokenId: listingTokenId,
        collectionKey,
      });

      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
      onInvalidate?.();
      setInstantErr(null);
      setInstantModalOpen(false);
    } catch (e: unknown) {
      setInstantErr(mapMatchError(e));
    } finally {
      setInstantBusy(null);
    }
  }

  useEffect(() => {
    if (!instantModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && instantBusy == null) {
        setInstantModalOpen(false);
        setInstantErr(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [instantModalOpen, instantBusy]);

  useEffect(() => {
    if (!instantModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [instantModalOpen]);

  const canInstantMatch =
    myAsks.length > 0 && bidRows.length > 0 && !!address && selectedAsk != null;

  useEffect(() => {
    if (instantModalOpen && !canInstantMatch) {
      setInstantModalOpen(false);
      setInstantErr(null);
    }
  }, [instantModalOpen, canInstantMatch]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-800/90 bg-[#12151c] shadow-[0_16px_48px_-20px_rgba(0,0,0,0.75)]">
      <div
        className="pointer-events-none absolute -right-8 -top-12 h-40 w-52 rounded-full bg-emerald-500/[0.12] blur-3xl"
        aria-hidden
      />
      <div className="relative border-b border-gray-800/80 px-2.5 pt-2.5 pb-1.5 sm:px-3 flex items-end justify-between gap-2">
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

      {tab === "book" && (
        <>
          <div className="relative grid grid-cols-[1fr_44px] gap-1.5 px-2.5 sm:px-3 py-1.5 text-[9px] font-medium text-gray-500 border-b border-gray-800/80">
            <span>Price (USDC)</span>
            <span className="text-right tabular-nums">Count</span>
          </div>

          {/* Asks — sell side; depth bars from the right */}
          <div className="min-h-[36px] max-h-[100px] flex flex-col justify-end gap-px px-1 pt-0.5 overflow-y-auto">
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

          {/* Reference price — large figure + arrow (no trade tape yet; ask/bid reference) */}
          <div className="relative mx-0.5 my-0.5 border-y border-gray-800/90 bg-[#0c0f14]/95 py-1.5 px-1.5">
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
              <div className="flex items-center gap-1">
                <span
                  className={`text-lg sm:text-xl font-bold tabular-nums tracking-tight ${
                    bookCenterDisplay.primaryTone === "ask"
                      ? "text-red-400"
                      : bookCenterDisplay.primaryTone === "bid"
                        ? "text-emerald-400"
                        : "text-gray-500"
                  }`}
                >
                  {bookCenterDisplay.primary}
                </span>
                {bookCenterDisplay.primaryTone === "ask" && (
                  <span className="text-base text-red-400/90 leading-none" aria-hidden>
                    ↓
                  </span>
                )}
                {bookCenterDisplay.primaryTone === "bid" && (
                  <span className="text-base text-emerald-400/90 leading-none" aria-hidden>
                    ↑
                  </span>
                )}
              </div>
              {bookCenterDisplay.secondary != null && (
                <span className="text-xs font-mono tabular-nums text-gray-500">
                  {bookCenterDisplay.secondary}
                </span>
              )}
            </div>
            <p className="text-center text-[9px] text-gray-600 mt-1 tabular-nums leading-tight">
              {bookCenterDisplay.caption}
            </p>
          </div>

          {/* Bids — buy side; depth bars from the left */}
          <div className="max-h-[100px] overflow-y-auto flex flex-col gap-px px-1 pb-1.5">
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

          {(myBids.length > 0 ||
            (myAsks.length > 0 && bidRows.length > 0 && address)) && (
            <div className="px-2 py-2 border-t border-gray-800/80 space-y-2">
              {myBids.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Your bids
                  </p>
                  <ul className="space-y-1">
                    {myBids.map((o) => (
                      <li
                        key={o.orderHash}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                      >
                        <span className="text-xs font-mono tabular-nums text-mint/95">
                          {formatPriceUsdc(displayBidUsdc(o))}{" "}
                          <span className="text-[10px] font-sans text-gray-500">USDC</span>
                        </span>
                        <button
                          type="button"
                          disabled={cancelling === o.orderHash}
                          onClick={() => void handleCancelBid(o)}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-white/5 text-gray-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
                        >
                          {cancelling === o.orderHash ? "…" : "Cancel"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {canInstantMatch && selectedInstantBid != null && (
                <div className="relative overflow-hidden rounded-xl border border-mint-deep/35 bg-gradient-to-r from-mint/10 via-[#0a1014]/90 to-transparent shadow-[inset_0_1px_0_0_rgba(148,255,212,0.14)]">
                  <div
                    className="pointer-events-none absolute -right-8 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-mint/18 blur-2xl"
                    aria-hidden
                  />
                  <div className="relative flex items-center gap-2.5 px-3 py-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/20 text-mint ring-1 ring-mint-deep/40">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-mint/95">
                        Instant match
                      </p>
                      <p className="mt-0.5 text-[10px] leading-snug text-gray-400">
                        Top bid{" "}
                        <span className="font-mono tabular-nums text-mint/90">
                          {formatPriceUsdc(displayBidUsdc(selectedInstantBid))} USDC
                        </span>
                        {bidRows.length > 1 ? ` · ${bidRows.length} bids` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInstantErr(null);
                        setInstantModalOpen(true);
                      }}
                      className="shrink-0 rounded-lg bg-gradient-to-r from-mint to-mint-dim px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-mint-ink shadow-md shadow-black/35 ring-1 ring-mint/45 transition hover:brightness-110 active:scale-[0.98]"
                    >
                      Match
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2 px-2.5 py-1.5 border-t border-gray-800/80 text-[9px] font-mono text-gray-600 tabular-nums">
            <span>
              Bids <span className="text-emerald-500/80">{bidRows.length}</span>
            </span>
            <span>
              Asks <span className="text-rose-400/80">{askRows.length}</span>
            </span>
          </div>
        </>
      )}

      {tab === "trades" && (
        <div className="max-h-[420px] overflow-y-auto py-10 px-4 text-center">
          <p className="text-[12px] text-gray-500 leading-relaxed">
            Recent fills for this collection are not shown here yet.
            <br />
            <span className="text-gray-600 text-[11px]">
              Use the token page for per-asset activity.
            </span>
          </p>
        </div>
      )}

      {typeof document !== "undefined" &&
        instantModalOpen &&
        canInstantMatch &&
        selectedAsk != null &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="instant-match-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              aria-label="Close"
              disabled={instantBusy != null}
              onClick={() => {
                if (instantBusy != null) return;
                setInstantModalOpen(false);
                setInstantErr(null);
              }}
            />
            <div
              className="relative z-[101] w-full max-w-lg max-h-[min(90dvh,720px)] sm:max-h-[min(92vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-mint-deep/30 bg-gradient-to-b from-[#0d1418] via-[#0a1014] to-[#07090c] shadow-2xl shadow-black/60 overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
            >
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-mint/14 blur-3xl" aria-hidden />
            <div className="relative flex items-start justify-between gap-3 px-4 py-4 border-b border-mint-deep/15 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint/18 text-mint ring-1 ring-mint-deep/40">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2
                    id="instant-match-modal-title"
                    className="text-base font-bold text-white tracking-tight"
                  >
                    Instant match
                  </h2>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                    Sell into a collection bid at the price shown. Confirm the buyer wallet before
                    you sign.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={instantBusy != null}
                onClick={() => {
                  if (instantBusy != null) return;
                  setInstantModalOpen(false);
                  setInstantErr(null);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            <div className="relative flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
              {instantMatchPreview?.needsReprice && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-[11px]">
                  <span className="text-gray-500">Reprice listing</span>
                  <span className="font-mono tabular-nums text-rose-300/90">
                    {formatPriceUsdc(instantMatchPreview.listingUsdc)} USDC
                  </span>
                  <span className="text-gray-600">→</span>
                  <span className="font-mono tabular-nums text-mint/90">
                    {formatPriceUsdc(instantMatchPreview.bidUsdc)} USDC
                  </span>
                  <span className="w-full text-[10px] text-gray-500 sm:w-auto sm:ml-auto">
                    Then match on-chain
                  </span>
                </div>
              )}

              {!instantMatchPreview?.needsReprice && instantMatchPreview != null && (
                <div className="rounded-xl border border-mint/20 bg-mint/[0.06] px-2.5 py-2 text-center">
                  <p className="text-[11px] font-mono tabular-nums text-mint/95">
                    Match at listing price{" "}
                    <span className="text-gray-400">
                      {formatPriceUsdc(instantMatchPreview.listingUsdc)} USDC
                    </span>
                  </p>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {myAsks.length === 1 && (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 sm:col-span-2">
                    <p className="text-[10px] font-medium text-gray-500">Your listing</p>
                    <p className="mt-0.5 font-mono text-xs text-white tabular-nums">
                      #{selectedAsk.tokenId} · {formatPriceUsdc(priceUsdcFromOrder(selectedAsk))}{" "}
                      USDC
                    </p>
                  </div>
                )}
                {myAsks.length > 1 && (
                  <label className="flex flex-col gap-1 sm:col-span-2 sm:max-w-none">
                    <span className="text-[10px] font-medium text-gray-400">Your listing</span>
                    <div className="relative">
                      <select
                        value={pickToken ?? ""}
                        onChange={(e) => setPickToken(Number(e.target.value))}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-[#0d1117]/90 py-2.5 pl-3 pr-8 text-xs font-mono text-white outline-none transition hover:border-white/15 focus:border-mint/40 focus:ring-1 focus:ring-mint/25"
                      >
                        {myAsks.map((a) => (
                          <option key={a.orderHash} value={Number(a.tokenId)}>
                            #{a.tokenId} · {formatPriceUsdc(priceUsdcFromOrder(a))} USDC
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                        ▼
                      </span>
                    </div>
                  </label>
                )}
                {bidRows.length === 1 && selectedInstantBid != null && (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 sm:col-span-2">
                    <p className="text-[10px] font-medium text-gray-500">Buyer bid</p>
                    <p className="mt-0.5 font-mono text-xs text-mint/90 tabular-nums">
                      {formatPriceUsdc(displayBidUsdc(selectedInstantBid))} USDC ·{" "}
                      <span className="text-gray-400">
                        {shortOfferer(selectedInstantBid.offerer)}
                      </span>
                    </p>
                  </div>
                )}
                {bidRows.length > 1 && selectedInstantBid != null && (
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[10px] font-medium text-gray-400">Buyer bid</span>
                    <div className="relative">
                      <select
                        value={selectedInstantBid.orderHash}
                        onChange={(e) => setInstantBidHash(e.target.value)}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-white/10 bg-[#0d1117]/90 py-2.5 pl-3 pr-8 text-xs font-mono text-white outline-none transition hover:border-white/15 focus:border-mint/40 focus:ring-1 focus:ring-mint/25"
                      >
                        {bidRows.map((b) => (
                          <option key={b.orderHash} value={b.orderHash}>
                            {formatPriceUsdc(displayBidUsdc(b))} USDC · {shortOfferer(b.offerer)}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                        ▼
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {selectedInstantBid != null && (
                <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
                  <p className="text-[10px] font-medium text-gray-500">Buyer (offerer)</p>
                  <p
                    className="mt-1 break-all font-mono text-[11px] leading-relaxed text-gray-200 select-all"
                    title={selectedInstantBid.offerer}
                  >
                    {selectedInstantBid.offerer}
                  </p>
                </div>
              )}

              {instantErr && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2">
                  <p className="text-[11px] text-red-400 break-all">{instantErr}</p>
                </div>
              )}

              <button
                type="button"
                disabled={instantBusy != null || selectedInstantBid == null}
                onClick={() => selectedInstantBid && void handleInstantSell(selectedInstantBid)}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-mint via-mint-dim to-mint-deep px-4 py-3 text-xs font-bold uppercase tracking-wide text-mint-ink shadow-lg shadow-black/45 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45"
              >
                <span className="relative z-10">
                  {instantBusy != null &&
                  selectedInstantBid != null &&
                  instantBusy === selectedInstantBid.orderHash
                    ? "Signing…"
                    : selectedInstantBid != null
                      ? `Sell · ${formatPriceUsdc(displayBidUsdc(selectedInstantBid))} USDC`
                      : "Instant match"}
                </span>
              </button>

              <p className="text-[10px] leading-relaxed text-mint-deep/55 pb-1">
                You&apos;ll approve wallet steps to re-list if needed, then run Seaport match.
                Always verify the buyer address above.
              </p>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
