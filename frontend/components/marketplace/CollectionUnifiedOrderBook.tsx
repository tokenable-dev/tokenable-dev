"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
        Number(o.tokenId) > 0
    );
  }, [askRows, address]);

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
    const tid = Number(selectedAsk.tokenId);

    setInstantBusy(bid.orderHash);
    try {
      let listing = selectedAsk;
      if (askAm > bidAm) {
        listing = await submitAskListingOrder({
          tokenId: tid,
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
        tokenId: tid,
        collectionKey,
      });

      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
      onInvalidate?.();
    } catch (e: unknown) {
      setInstantErr(mapMatchError(e));
    } finally {
      setInstantBusy(null);
    }
  }

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
                  <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1 w-full px-2 py-1.5 text-[11px] font-mono tabular-nums items-start">
                    <div className="min-w-0 pr-1">
                      <div className="text-rose-400 font-medium leading-tight">
                        {formatPriceUsdc(level.price)}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
                        {level.orders.map((o) => (
                          <Link
                            key={o.orderHash}
                            href={`/marketplace/${Number(o.tokenId)}?fromCollection=${encodeURIComponent(collectionKey)}`}
                            className="text-[9px] font-sans text-gray-500 hover:text-mint tabular-nums underline-offset-2 hover:underline"
                          >
                            #{o.tokenId}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <span className="text-right text-gray-400 leading-tight pt-0.5">{level.count}</span>
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
              bidLevels.map((level) => {
                const multi = level.count > 1;
                return (
                  <div key={level.key} className="rounded-sm overflow-hidden">
                    <div
                      className={`relative min-h-[28px] flex items-center overflow-hidden group ${
                        multi ? "bg-mint/[0.03]" : ""
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-mint/[0.12]"
                        style={{ width: `${Math.min(100, level.depth * 100)}%` }}
                      />
                      <div className="relative z-10 grid grid-cols-[1fr_44px] gap-1 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center">
                        <span className="text-mint font-medium flex items-center gap-1.5 min-w-0">
                          <span>{formatPriceUsdc(level.price)}</span>
                          {multi && (
                            <span className="text-[9px] font-semibold uppercase px-1 py-0 rounded bg-mint/15 text-mint/90 border border-mint-deep/25 shrink-0">
                              ×{level.count}
                            </span>
                          )}
                        </span>
                        <span className="text-right text-gray-400">{level.count}</span>
                      </div>
                    </div>

                    {level.orders.map((o) => {
                      const mine =
                        address != null && address.toLowerCase() === o.offerer.toLowerCase();
                      let display = priceUsdcFromOrder(o);
                      try {
                        const offer0 = o.parameters?.offer?.[0];
                        if (offer0?.startAmount)
                          display = Number(formatUnits(BigInt(offer0.startAmount), 6));
                      } catch {
                        /* */
                      }
                      const canInstant = myAsks.length > 0 && selectedAsk != null && address;

                      return (
                        <div
                          key={o.orderHash}
                          className="px-3 py-2 border-t border-gray-800/40 bg-black/20 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] text-gray-600 truncate font-mono">
                              {shortAddr(o.offerer)}
                            </p>
                            {mine && (
                              <button
                                type="button"
                                disabled={cancelling === o.orderHash}
                                onClick={() => void handleCancelBid(o)}
                                className="text-[10px] font-semibold px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40"
                              >
                                {cancelling === o.orderHash ? "…" : "Cancel"}
                              </button>
                            )}
                          </div>

                          {canInstant && (
                            <div className="rounded-md border border-gray-800/90 bg-black/35 px-2 py-2 space-y-1.5">
                              {myAsks.length > 1 && (
                                <label className="flex flex-col gap-0.5">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">
                                    Your listing
                                  </span>
                                  <select
                                    value={pickToken ?? ""}
                                    onChange={(e) => setPickToken(Number(e.target.value))}
                                    className="text-[10px] rounded border border-gray-800 bg-black/50 text-gray-200 px-1.5 py-1 font-mono"
                                  >
                                    {myAsks.map((a) => (
                                      <option key={a.orderHash} value={Number(a.tokenId)}>
                                        #{a.tokenId} — {formatPriceUsdc(priceUsdcFromOrder(a))} USDC
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <button
                                type="button"
                                disabled={instantBusy === o.orderHash}
                                onClick={() => void handleInstantSell(o)}
                                className="w-full text-[10px] font-bold py-1.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
                              >
                                {instantBusy === o.orderHash
                                  ? "Working…"
                                  : `Instant sell @ ${formatPriceUsdc(display)} USDC`}
                              </button>
                              <p className="text-[9px] text-gray-600 leading-snug">
                                Reprices your listing to the bid if needed, then matches on-chain.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

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

          {instantErr && (
            <div className="mx-2 mb-2 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/25">
              <p className="text-[10px] text-red-400 break-all">{instantErr}</p>
            </div>
          )}
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
    </div>
  );
}
