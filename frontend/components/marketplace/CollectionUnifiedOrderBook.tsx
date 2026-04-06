"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
}

export function CollectionUnifiedOrderBook({
  collectionKey,
  asks,
  collectionBids,
  address: addressProp,
  onInvalidate,
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

  const midLabel = useMemo(() => {
    if (bestAskPrice != null && bestBidPrice != null) {
      return ((bestAskPrice + bestBidPrice) / 2).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (bestAskPrice != null)
      return bestAskPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (bestBidPrice != null)
      return bestBidPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return "—";
  }, [bestAskPrice, bestBidPrice]);

  const spreadText = useMemo(() => {
    if (bestAskPrice != null && bestBidPrice != null) {
      const s = bestAskPrice - bestBidPrice;
      return `Spread ${s.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    }
    if (bestAskPrice != null) return `Best ask ${formatPriceUsdc(bestAskPrice)} USDC`;
    if (bestBidPrice != null) return `Best bid ${formatPriceUsdc(bestBidPrice)} USDC`;
    return "No orders";
  }, [bestAskPrice, bestBidPrice]);

  const myAsks = useMemo(() => {
    if (!address) return [];
    const a = address.toLowerCase();
    return askRows.filter(
      (o) =>
        o.status === "active" &&
        (o.side === "ask" || o.side == null) &&
        o.offerer.toLowerCase() === a &&
        Number.isFinite(Number(o.tokenId)) &&
        Number(o.tokenId) >= 0
    );
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

  const bidCount = bidRows.length;
  const askCount = askRows.length;
  const denom = bidCount + askCount || 1;
  const bidPct = Math.round((bidCount / denom) * 100);

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
    <div className="rounded-2xl border border-mint-deep/20 bg-gradient-to-b from-[#0c1018] to-[#07090c] overflow-hidden shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]">
      <div className="px-4 pt-4 pb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Order book</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Price (USDC) · Qty (listings)</p>
        </div>
      </div>

      <div className="flex border-b border-gray-800/90 mt-1">
        <button
          type="button"
          onClick={() => setTab("book")}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            tab === "book"
              ? "text-white border-b-2 border-mint bg-white/[0.03]"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Order book
        </button>
        <button
          type="button"
          onClick={() => setTab("trades")}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wide transition-colors ${
            tab === "trades"
              ? "text-white border-b-2 border-mint bg-white/[0.03]"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Recent trades
        </button>
      </div>

      {tab === "book" && (
        <>
          <div className="grid grid-cols-[1fr_44px] gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800/80">
            <span>Price</span>
            <span className="text-right">Qty</span>
          </div>

          {/* Asks — red, highest price at top */}
          <div className="min-h-[48px] max-h-[180px] flex flex-col justify-end gap-px px-1 pt-1 overflow-y-auto">
            {askLevels.length === 0 ? (
              <div className="py-5 text-center text-[11px] text-gray-600">No sell orders</div>
            ) : (
              askLevels.map((level) => (
                <div
                  key={level.key}
                  className="relative min-h-[28px] flex items-start rounded-sm overflow-hidden group"
                >
                  <div
                    className="absolute inset-y-0 right-0 bg-rose-500/[0.14] transition-[width]"
                    style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                  />
                  <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1 w-full px-2 py-1.5 text-[11px] font-mono tabular-nums items-center">
                    <span className="text-rose-400 font-medium leading-tight">
                      {formatPriceUsdc(level.price)}
                    </span>
                    <span className="text-right text-gray-400 leading-tight">{level.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Mid */}
          <div className="my-0.5 mx-1 rounded-lg bg-gray-900/90 border border-gray-800 py-2.5 px-2">
            <div className="text-center">
              <div className="text-lg font-bold text-mint tabular-nums tracking-tight">
                {midLabel}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{spreadText}</div>
              <div className="text-[10px] text-gray-600 mt-1">Collection mid · USDC</div>
            </div>
          </div>

          {/* Bids — green */}
          <div className="max-h-[220px] overflow-y-auto flex flex-col gap-px px-1 pb-1">
            {bidLevels.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-gray-600">No buy orders</div>
            ) : (
              bidLevels.map((level) => (
                <div
                  key={level.key}
                  className="relative min-h-[28px] flex items-start rounded-sm overflow-hidden group"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-mint/[0.12] transition-[width]"
                    style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                  />
                  <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1 w-full px-2 py-1.5 text-[11px] font-mono tabular-nums items-center">
                    <span className="text-mint font-medium leading-tight">
                      {formatPriceUsdc(level.price)}
                    </span>
                    <span className="text-right text-gray-400 leading-tight">{level.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {(myBids.length > 0 ||
            (myAsks.length > 0 && bidRows.length > 0 && address)) && (
            <div className="px-3 py-3 border-t border-gray-800/80 space-y-3">
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

          <div className="px-3 py-2 border-t border-gray-800/90">
            <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-gray-800">
              <div className="h-full bg-mint/80 transition-all" style={{ width: `${bidPct}%` }} />
              <div className="h-full flex-1 bg-rose-500/80" />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
              <span className="text-mint/90">Bids {bidPct}%</span>
              <span className="text-rose-400/90">Asks {100 - bidPct}%</span>
            </div>
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

      {instantModalOpen && canInstantMatch && selectedAsk != null && (
        <div
          className="fixed inset-0 z-[85] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4"
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
            className="relative z-[86] w-full max-w-lg max-h-[min(90dvh,720px)] sm:max-h-[min(92vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-mint-deep/30 bg-gradient-to-b from-[#0d1418] via-[#0a1014] to-[#07090c] shadow-2xl shadow-black/60 overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
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
        </div>
      )}
    </div>
  );
}
