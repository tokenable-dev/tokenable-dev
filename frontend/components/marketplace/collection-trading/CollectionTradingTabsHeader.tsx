"use client";

import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
  COLLECTION_DETAILS_BORDER_B,
} from "@/components/marketplace/collectionOverviewChrome";
export function CollectionTradingTabsHeader({
  collectionLabel,
  flush,
  docked,
  dockControlled,
  onCloseDock,
}: {
  collectionLabel: string;
  flush: boolean;
  docked: boolean;
  dockControlled: boolean;
  onCloseDock?: () => void;
}) {
  return (
    <div
      className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3 ${
        flush && !docked
          ? "border-b border-[rgba(38,39,45,1)] bg-transparent"
          : docked
            ? "border-b border-[rgba(38,39,45,1)] bg-transparent"
            : `${COLLECTION_DETAILS_BORDER_B} ${COLLECTION_DETAILS_BG_CLASS}`
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className="truncate text-[10px] font-medium text-zinc-300"
          title={`${collectionLabel} · priced in USDC`}
        >
          {collectionLabel}
        </span>
        <span
          className={`inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded ${COLLECTION_DETAILS_BORDER_ALL} text-[9px] font-semibold leading-none text-zinc-500`}
          title="Collection market: bids and asks in USDC (Sepolia)."
        >
          i
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {docked && dockControlled ? (
          <button
            type="button"
            onClick={onCloseDock}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${COLLECTION_DETAILS_BORDER_ALL} text-zinc-400 transition-colors hover:bg-zinc-800/80 hover:text-zinc-100`}
            aria-label="Close trade panel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
