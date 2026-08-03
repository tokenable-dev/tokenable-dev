"use client";

import type { Order } from "@/lib/core";
import {
  bidMaxUsdcFromOrder,
  formatOrderUsdc6,
} from "@/lib/marketplace/collection-trading/orderUsdcFormat";

export function CollectionMyOrdersEmbeddedBody({
  addr,
  total,
  myListings,
  myBids,
  cancelling,
  onCancel,
  onChangeBidPrice,
  isBidStale,
  variant = "compact",
}: {
  addr: string;
  total: number;
  myListings: Order[];
  myBids: Order[];
  cancelling: string | null;
  onCancel: (orderHash: string) => void;
  onChangeBidPrice: (bid: Order) => void;
  isBidStale: (o: Order) => boolean;
  /** Order book Orders tab — larger type and brighter contrast. */
  variant?: "compact" | "orderBook";
}) {
  const isOrderBook = variant === "orderBook";

  const emptyCls = isOrderBook
    ? "py-8 text-center text-[13px] text-zinc-300"
    : "py-6 text-center text-xs text-zinc-500";
  const sectionLabelCls = isOrderBook
    ? "px-0.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300"
    : "px-0.5 py-1 text-[9px] font-medium uppercase tracking-wide text-zinc-600";
  const rowCls = isOrderBook
    ? "flex items-center justify-between gap-3 py-2.5 text-[13px] first:pt-1.5"
    : "flex items-center justify-between gap-2 py-2 text-xs first:pt-1";
  const sideLabelCls = isOrderBook ? "text-zinc-400" : "text-zinc-500";
  const priceCls = isOrderBook
    ? "ml-2 font-mono tabular-nums text-zinc-200"
    : "ml-2 font-mono tabular-nums text-zinc-400";
  const usdcCls = isOrderBook ? "text-zinc-400" : "text-zinc-600";
  const bidPriceCls = isOrderBook
    ? "font-mono tabular-nums text-zinc-200"
    : "font-mono tabular-nums text-zinc-400";
  const cancelListingCls = isOrderBook
    ? "shrink-0 text-[12px] font-semibold text-rose-300 hover:text-rose-200 disabled:opacity-40"
    : "shrink-0 text-[10px] font-medium text-rose-400/90 hover:text-rose-300 disabled:opacity-40";
  const changePriceCls = isOrderBook
    ? "text-[12px] font-semibold text-mint hover:text-mint/90 disabled:opacity-40"
    : "text-[10px] font-medium text-mint/90 hover:text-mint disabled:opacity-40";
  const cancelBidCls = isOrderBook
    ? "text-[12px] font-semibold text-zinc-300 hover:text-white disabled:opacity-40"
    : "text-[10px] font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-40";
  const staleBadgeCls = isOrderBook
    ? "ml-1.5 rounded border border-amber-500/35 bg-amber-500/[0.12] px-1.5 py-0.5 text-[10px] font-medium text-amber-100/95"
    : "ml-1.5 rounded border border-amber-500/35 bg-amber-500/[0.12] px-1 py-px text-[9px] font-medium text-amber-200/95";
  const actionGapCls = isOrderBook ? "gap-2.5" : "gap-2";

  if (!addr) {
    return <p className={emptyCls}>Connect wallet to view orders.</p>;
  }

  if (total === 0) {
    return (
      <p
        className={emptyCls}
        title="Use Buy or Sell to place orders; they appear here when active."
      >
        No active orders.
      </p>
    );
  }

  return (
    <div className="divide-y divide-zinc-800/80">
      {myListings.length > 0 ? (
        <div className={isOrderBook ? "py-1.5" : "py-1"}>
          <p className={sectionLabelCls}>Listings</p>
          <ul className="divide-y divide-zinc-800/60">
            {myListings.map((o) => (
              <li key={o.orderHash} className={rowCls}>
                <div className="min-w-0">
                  <span className={sideLabelCls}>Ask</span>
                  <span className={priceCls}>{formatOrderUsdc6(o.considerationAmount)}</span>
                  <span className={usdcCls}> USDC</span>
                </div>
                <button
                  type="button"
                  disabled={cancelling === o.orderHash}
                  onClick={() => onCancel(o.orderHash)}
                  className={cancelListingCls}
                  title="Cancel this listing"
                >
                  {cancelling === o.orderHash ? "…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {myBids.length > 0 ? (
        <div className={isOrderBook ? "py-1.5" : "py-1"}>
          <p className={sectionLabelCls}>Bids</p>
          <ul className="divide-y divide-zinc-800/60">
            {myBids.map((o) => (
              <li key={o.orderHash} className={rowCls}>
                <div className="min-w-0">
                  <span className={sideLabelCls}>Bid</span>{" "}
                  <span className={bidPriceCls}>{bidMaxUsdcFromOrder(o)}</span>
                  <span className={usdcCls}> USDC</span>
                  {isBidStale(o) ? (
                    <span
                      className={staleBadgeCls}
                      title="This bid was signed with an older Merkle pool. Cancel it and place again from Buy (same USDC) so matchAdvancedOrders can run."
                    >
                      Pool outdated
                    </span>
                  ) : null}
                </div>
                <div className={`flex shrink-0 items-center ${actionGapCls}`}>
                  <button
                    type="button"
                    disabled={cancelling === o.orderHash}
                    onClick={() => onChangeBidPrice(o)}
                    className={changePriceCls}
                    title="Change bid price"
                  >
                    Change price
                  </button>
                  <button
                    type="button"
                    disabled={cancelling === o.orderHash}
                    onClick={() => onCancel(o.orderHash)}
                    className={cancelBidCls}
                    title="Cancel collection bid"
                  >
                    {cancelling === o.orderHash ? "…" : "Cancel"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
