"use client";

import type { ReactNode } from "react";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";

export function CollectionOverviewBookColumn({
  orderBook,
  tradeTicket,
}: {
  orderBook?: ReactNode;
  tradeTicket?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full max-w-[300px] flex-col gap-0 lg:sticky lg:top-4 lg:justify-self-end">
      {orderBook != null && <div className="min-h-0 min-w-0">{orderBook}</div>}
      {tradeTicket != null && (
        <div
          className={`mt-4 rounded-xl ${COLLECTION_DETAILS_BORDER_ALL} ${COLLECTION_DETAILS_BG_CLASS} px-3 py-3 sm:px-4 sm:py-4`}
        >
          {tradeTicket}
        </div>
      )}
    </div>
  );
}
