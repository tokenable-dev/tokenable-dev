"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/lib/api";

const USDC_DECIMALS = 6;

function priceFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 10 ** USDC_DECIMALS;
}

/** 동일 가격 입찰을 한 줄로 묶기 위한 키 (부동소수 오차 방지) */
function priceKey(p: number): number {
  return Math.round(p * 1_000_000) / 1_000_000;
}

function shortOfferer(addr: string): string {
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type OrderBookTab = "book" | "trades";

interface NftOrderBookProps {
  listing: Order | null;
  bids: Order[];
  bidsLoading: boolean;
  activity?: Order[];
  activityLoading?: boolean;
  tokenId: number;
  address?: string;
  isOwner: boolean;
  isAccepting: boolean;
  isBuying: boolean;
  acceptingBidHash: string | null;
  cancelBidHash: string | null;
  onAcceptBid: (bid: Order) => void;
  onCancelBid: (bid: Order) => void;
  onPlaceBid: () => void;
  acceptErrorMsg?: string;
  /** 루트 카드에 추가 클래스 (상세 페이지 프레이밍용) */
  className?: string;
}

const MAX_BID_ROWS = 14;

function tradeTimeLabel(o: Order): string {
  const raw = o.updatedAt ?? o.createdAt;
  if (raw == null || raw === "") return "—";
  const s = String(raw).trim();
  const d = new Date(
    /Z$|[+-]\d{2}:?\d{2}$/i.test(s) ? s : s.includes("T") ? `${s}Z` : s
  );
  return Number.isFinite(d.getTime())
    ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

/**
 * NFT 상세용 — 거래소 스타일 오더북 (매도 호가 위 · 스프레드 · 매수 호가 아래, 뎁스 바)
 */
export function NftOrderBook({
  listing,
  bids,
  bidsLoading,
  activity = [],
  activityLoading = false,
  tokenId,
  address,
  isOwner,
  isAccepting,
  isBuying,
  acceptingBidHash,
  cancelBidHash,
  onAcceptBid,
  onCancelBid,
  onPlaceBid,
  acceptErrorMsg,
  className = "",
}: NftOrderBookProps) {
  const [tab, setTab] = useState<OrderBookTab>("book");

  const bestAsk = listing ? priceFromOrder(listing) : null;
  const bestBid = bids[0] ? priceFromOrder(bids[0]) : null;

  const midLabel = useMemo(() => {
    if (bestAsk != null && bestBid != null) {
      return ((bestAsk + bestBid) / 2).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (bestAsk != null) return bestAsk.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (bestBid != null) return bestBid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return "—";
  }, [bestAsk, bestBid]);

  const spreadText = useMemo(() => {
    if (bestAsk != null && bestBid != null) {
      const s = bestAsk - bestBid;
      return `Spread ${s.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    }
    if (bestAsk != null) return `Best ask ${bestAsk.toFixed(2)} USDC`;
    if (bestBid != null) return `Best bid ${bestBid.toFixed(2)} USDC`;
    return "No orders";
  }, [bestAsk, bestBid]);

  /** 매도: 스프레드에 가까운 쪽이 아래 — 가격 내림차순으로 위에서 아래로 (한 건만 있으면 하단에 붙음) */
  const askRows = useMemo(() => {
    if (!listing) return [];
    const p = priceFromOrder(listing);
    return [{ price: p, qty: 1, order: listing, key: listing.orderHash }];
  }, [listing]);

  const maxAskPrice = askRows.length ? Math.max(...askRows.map((r) => r.price), 1) : 1;

  /**
   * 매수: 동일 가격 입찰을 한 레벨로 묶음 (API 순서와 무관).
   * Amount = 해당 가격대 입찰 수, Total = 누적 USDC(뎁스).
   */
  const bidLevels = useMemo(() => {
    const slice = bids.slice(0, MAX_BID_ROWS);
    const maxCum =
      slice.reduce((acc, b) => acc + priceFromOrder(b), 0) || 1;

    const byKey = new Map<number, Order[]>();
    const sorted = [...slice].sort((a, b) => {
      const pa = priceFromOrder(a);
      const pb = priceFromOrder(b);
      if (pb !== pa) return pb - pa;
      return String(a.orderHash).localeCompare(String(b.orderHash));
    });
    for (const b of sorted) {
      const k = priceKey(priceFromOrder(b));
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(b);
    }
    const keysDesc = [...byKey.keys()].sort((a, b) => b - a);

    let cum = 0;
    return keysDesc.map((k) => {
      const orders = byKey.get(k)!;
      const price = priceFromOrder(orders[0]);
      const levelSum = price * orders.length;
      cum += levelSum;
      return {
        price,
        orders,
        count: orders.length,
        total: cum,
        depth: cum / maxCum,
        key: `${k}-${orders.map((o) => o.orderHash).join("|")}`,
      };
    });
  }, [bids]);

  const bidCount = bids.length;
  const askCount = listing ? 1 : 0;
  const denom = bidCount + askCount || 1;
  const bidPct = Math.round((bidCount / denom) * 100);

  return (
    <div
      className={`rounded-2xl border border-mint-deep/20 bg-gradient-to-b from-[#0c1018] to-[#07090c] overflow-hidden shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] ${className}`}
    >
      <div className="px-4 pt-4 pb-1">
        <h2 className="text-lg font-bold text-white tracking-tight">Order book</h2>
        <p className="text-[11px] text-gray-500 mt-0.5">Price · Amount · Total (USDC)</p>
        <p className="text-[10px] text-gray-600 mt-1.5 leading-snug px-0.5">
          Matching prices are grouped — <span className="text-gray-500">Amount</span> is how many
          bids sit at that price. Expand rows list each buyer so the seller can choose who to sell
          to.
        </p>
      </div>
      {/* Tabs */}
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
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_52px_72px] gap-1 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-800/80">
            <span>Price</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Total</span>
          </div>

          {/* Asks — red, 스프레드에 붙은 쪽이 아래(매도 호가는 보통 최저가가 스프레드 근처) */}
          <div className="min-h-[56px] max-h-[160px] flex flex-col justify-end gap-px px-1 pt-1 overflow-y-auto">
            {!listing ? (
              <div className="py-5 text-center text-[11px] text-gray-600">No sell orders</div>
            ) : (
              askRows
                .slice()
                .sort((a, b) => b.price - a.price)
                .map((row) => {
                  const depth = row.price / maxAskPrice;
                  return (
                    <div
                      key={row.key}
                      className="relative h-7 flex items-center rounded-sm overflow-hidden"
                    >
                      <div
                        className="absolute inset-y-0 right-0 bg-rose-500/[0.12] transition-[width]"
                        style={{ width: `${Math.min(100, depth * 100)}%` }}
                      />
                      <div className="relative z-10 grid grid-cols-[1fr_52px_72px] gap-1 w-full px-2 text-[11px] font-mono tabular-nums leading-none">
                        <span className="text-rose-400 font-medium">
                          {row.price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-right text-gray-400">{row.qty}</span>
                        <span className="text-right text-gray-500">
                          {row.price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Mid / spread */}
          <div className="my-0.5 mx-1 rounded-lg bg-gray-900/90 border border-gray-800 py-2.5 px-2">
            <div className="text-center">
              <div className="text-lg font-bold text-mint tabular-nums tracking-tight">
                {midLabel}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">{spreadText}</div>
              <div className="text-[10px] text-gray-600 mt-1 font-mono">#{tokenId}</div>
            </div>
          </div>

          {/* Bids — green */}
          <div className="max-h-[220px] overflow-y-auto flex flex-col gap-px px-1 pb-1">
            {bidsLoading ? (
              <div className="py-8 text-center text-xs text-gray-500 animate-pulse">Loading bids…</div>
            ) : bidLevels.length === 0 ? (
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
                      <div className="relative z-10 grid grid-cols-[1fr_52px_72px] gap-1 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center">
                        <span className="text-mint font-medium flex items-center gap-1.5 min-w-0">
                          <span>
                            {level.price.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          {multi && (
                            <span className="text-[9px] font-semibold uppercase px-1 py-0 rounded bg-mint/15 text-mint/90 border border-mint-deep/25 shrink-0">
                              ×{level.count}
                            </span>
                          )}
                        </span>
                        <span className="text-right text-gray-400">{level.count}</span>
                        <span className="text-right text-gray-500">
                          {level.total.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {!multi && level.orders[0] && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100">
                          {isOwner &&
                            address?.toLowerCase() !==
                              level.orders[0].offerer.toLowerCase() && (
                              <button
                                type="button"
                                disabled={isAccepting || isBuying}
                                onClick={() => onAcceptBid(level.orders[0])}
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-mint-dim text-mint-ink hover:brightness-110 disabled:opacity-40"
                              >
                                {acceptingBidHash === level.orders[0].orderHash && isAccepting
                                  ? "…"
                                  : "Sell"}
                              </button>
                            )}
                          {address?.toLowerCase() ===
                            level.orders[0].offerer.toLowerCase() && (
                            <button
                              type="button"
                              disabled={!!cancelBidHash}
                              onClick={() => onCancelBid(level.orders[0])}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                            >
                              {cancelBidHash === level.orders[0].orderHash ? "…" : "×"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {multi &&
                      level.orders.map((order) => {
                        const isMine =
                          address?.toLowerCase() === order.offerer.toLowerCase();
                        return (
                          <div
                            key={order.orderHash}
                            className="relative flex items-center justify-between gap-2 pl-4 pr-2 py-1 border-t border-gray-800/50 bg-black/20"
                          >
                            <span className="text-[10px] text-gray-500 font-mono truncate">
                              {shortOfferer(order.offerer)}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              {isOwner && !isMine && (
                                <button
                                  type="button"
                                  disabled={isAccepting || isBuying}
                                  onClick={() => onAcceptBid(order)}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-mint-dim text-mint-ink hover:brightness-110 disabled:opacity-40"
                                >
                                  {acceptingBidHash === order.orderHash && isAccepting
                                    ? "…"
                                    : "Sell"}
                                </button>
                              )}
                              {isMine && (
                                <button
                                  type="button"
                                  disabled={!!cancelBidHash}
                                  onClick={() => onCancelBid(order)}
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                                >
                                  {cancelBidHash === order.orderHash ? "…" : "×"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })
            )}
          </div>

          {/* Bid / ask pressure */}
          <div className="px-3 py-2 border-t border-gray-800/90">
            <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-gray-800">
              <div
                className="h-full bg-mint/80 transition-all"
                style={{ width: `${bidPct}%` }}
              />
              <div className="h-full flex-1 bg-rose-500/80" />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
              <span className="text-mint/90">Bids {bidPct}%</span>
              <span className="text-rose-400/90">Asks {100 - bidPct}%</span>
            </div>
          </div>

          {acceptErrorMsg && (
            <div className="mx-2 mb-2 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/25">
              <p className="text-[10px] text-red-400 break-all">{acceptErrorMsg}</p>
            </div>
          )}

          <div className="p-2 border-t border-gray-800/90 space-y-1.5">
            {address && !isOwner && (
              <button
                type="button"
                onClick={onPlaceBid}
                className="w-full py-2.5 text-xs font-bold rounded-lg bg-mint/15 text-mint border border-mint-deep/35 hover:bg-mint/25 transition-colors"
              >
                Place bid
              </button>
            )}
            {address && isOwner && (
              <p className="text-[10px] text-center text-gray-600 px-1">
                You own this asset — use Sell on a bid or list an ask from My Assets.
              </p>
            )}
          </div>
        </>
      )}

      {tab === "trades" && (
        <div className="max-h-[420px] overflow-y-auto">
          {activityLoading ? (
            <div className="py-12 text-center text-xs text-gray-500 animate-pulse">Loading…</div>
          ) : !activity?.length ? (
            <div className="py-12 text-center text-xs text-gray-600">No trades yet</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800/80">
                  <th className="text-left font-medium py-2 pl-3">Price</th>
                  <th className="text-left font-medium py-2">Side</th>
                  <th className="text-right font-medium py-2 pr-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {[...activity]
                  .sort(
                    (a, b) =>
                      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
                  )
                  .slice(0, 40)
                  .map((o) => {
                    const side = o.side ?? "ask";
                    const price = priceFromOrder(o);
                    const isBid = side === "bid";
                    return (
                      <tr key={o.orderHash} className="font-mono tabular-nums">
                        <td className={`py-1.5 pl-3 ${isBid ? "text-mint" : "text-rose-400"}`}>
                          {price.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-1.5 text-gray-400 capitalize">{side}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-500">
                          {tradeTimeLabel(o)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
