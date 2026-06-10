"use client";

import { COLLECTION_ORDER_BOOK_FLUSH_INSET_X } from "@/components/marketplace/collectionOverviewChrome";
import { OrderBookTradesTab } from "@/components/marketplace/unified-order-book/OrderBookTradesTab";
import type { CollectionPlatformTapeFill } from "@/lib/core";
import { rwaDetailRightFont } from "../theme";

export function RwaDetailTradesPanel({
  trades,
  loading,
  tradesAvailable,
  className = "",
}: {
  trades: CollectionPlatformTapeFill[];
  loading: boolean;
  tradesAvailable: boolean;
  className?: string;
}) {
  return (
    <section
      className={`@container/orderbook flex min-h-0 w-full min-w-0 flex-col ${className}`}
      aria-label="Trades"
    >
      <h2
        className={`${rwaDetailRightFont.className} text-[18px] font-bold leading-[140%] tracking-normal text-white`}
      >
        Trades
      </h2>

      {!tradesAvailable ? (
        <p
          className={`${rwaDetailRightFont.className} mt-4 text-[14px] leading-relaxed text-zinc-500`}
        >
          Trades appear when this card is linked to a collection.
        </p>
      ) : (
        <div className="mt-3 flex min-h-0 max-h-[min(280px,40vh)] flex-col overflow-hidden sm:mt-4">
          <OrderBookTradesTab
            tapeFills={trades}
            tapeLoading={loading}
            flush
            emptyLabel="No trades yet"
          />
        </div>
      )}
    </section>
  );
}
