"use client";

import {
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";

export function CriteriaBidFormHeader({
  embedded,
  buyHelpTitle,
  title,
}: {
  embedded: boolean;
  buyHelpTitle: string;
  title?: string;
}) {
  if (embedded) {
    return (
      <div className={`flex items-center justify-between gap-2 pb-2 pt-0.5 ${COLLECTION_DETAILS_BORDER_B}`}>
        <h2 className="text-xs font-semibold tracking-tight text-white">
          {title ?? "Buy"}
        </h2>
        <span
          className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded ${COLLECTION_DETAILS_BORDER_ALL} text-[9px] font-semibold leading-none text-zinc-500`}
          title={buyHelpTitle}
        >
          i
        </span>
      </div>
    );
  }

  return (
    <div className={`px-4 pb-3 pt-4 ${COLLECTION_DETAILS_BORDER_B}`}>
      <h2 className="text-lg font-bold tracking-tight text-white">Buy in this collection</h2>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
        One price, one button: at or above the <span className="text-gray-400">best ask</span> you
        buy the <span className="text-gray-400">cheapest listing</span> (you pay its list price);
        below that you place a collection bid up to your amount.
      </p>
    </div>
  );
}
