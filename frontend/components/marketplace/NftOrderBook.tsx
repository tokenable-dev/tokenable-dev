"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/lib/api";

const USDC_DECIMALS = 6;

function priceFromOrder(o: Order): number {
  return Number(o.considerationAmount) / 10 ** USDC_DECIMALS;
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

  /** 매수: 고가 우선, 누적 합계 USDC */
  const bidRows = useMemo(() => {
    let cum = 0;
    const maxCum = bids.reduce((acc, b) => acc + priceFromOrder(b), 0) || 1;
    return bids.slice(0, MAX_BID_ROWS).map((b) => {
      const price = priceFromOrder(b);
      cum += price;
      return {
        price,
        qty: 1,
        total: cum,
        depth: cum / maxCum,
        order: b,
        key: b.orderHash,
      };
    });
  }, [bids]);

  const bidCount = bids.length;
  const askCount = listing ? 1 : 0;
  const denom = bidCount + askCount || 1;
  const bidPct = Math.round((bidCount / denom) * 100);

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0b0e11] overflow-hidden shadow-xl shadow-black/40">
      {/* Tabs */}
      <div className="flex border-b border-gray-800/90">
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
            <span>Price (USDC)</span>
            <span className="text-right">Qty</span>
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
            ) : bidRows.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-gray-600">No buy orders</div>
            ) : (
              bidRows.map((row) => {
                const isMine =
                  address?.toLowerCase() === row.order.offerer.toLowerCase();
                return (
                  <div
                    key={row.key}
                    className="relative min-h-[28px] flex items-center rounded-sm overflow-hidden group"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-mint/[0.12]"
                      style={{ width: `${Math.min(100, row.depth * 100)}%` }}
                    />
                    <div className="relative z-10 grid grid-cols-[1fr_52px_72px] gap-1 w-full px-2 py-1 text-[11px] font-mono tabular-nums items-center">
                      <span className="text-mint font-medium">
                        {row.price.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-right text-gray-400">{row.qty}</span>
                      <span className="text-right text-gray-500">
                        {row.total.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 sm:opacity-100">
                      {isOwner && !isMine && (
                        <button
                          type="button"
                          disabled={isAccepting || isBuying}
                          onClick={() => onAcceptBid(row.order)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-mint-dim text-mint-ink hover:brightness-110 disabled:opacity-40"
                        >
                          {acceptingBidHash === row.order.orderHash && isAccepting
                            ? "…"
                            : "Sell"}
                        </button>
                      )}
                      {isMine && (
                        <button
                          type="button"
                          disabled={!!cancelBidHash}
                          onClick={() => onCancelBid(row.order)}
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40"
                        >
                          {cancelBidHash === row.order.orderHash ? "…" : "×"}
                        </button>
                      )}
                    </div>
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
                You own this NFT — use Sell on a bid or list an ask from My NFTs.
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
