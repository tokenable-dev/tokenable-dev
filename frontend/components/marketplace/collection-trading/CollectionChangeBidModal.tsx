"use client";

import type { Order } from "@/lib/core";
import { bidMaxUsdcFromOrder } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { CollectionCriteriaBidPanel } from "@/components/marketplace/collection-criteria-bid";

export function CollectionChangeBidModal({
  open,
  bid,
  collectionKey,
  activeAsks,
  connectedAddress,
  onClose,
  onUpdated,
}: {
  open: boolean;
  bid: Order | null;
  collectionKey: string;
  activeAsks: Order[];
  connectedAddress?: string;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  if (!open || bid == null) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center px-0 py-0 sm:items-center sm:px-4 sm:py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-change-bid-title"
        className="relative flex max-h-[min(88svh,520px)] w-full max-w-[min(100%,26rem)] flex-col overflow-hidden rounded-t-2xl border border-zinc-700/90 bg-zinc-950 shadow-xl shadow-black/40 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/90 px-5 py-5 sm:px-6">
          <div className="min-w-0 pr-8">
            <h2
              id="collection-change-bid-title"
              className="text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              Change bid price
            </h2>
            <p className="mt-1.5 text-sm leading-snug text-zinc-400">
              Current bid:{" "}
              <span className="font-mono tabular-nums text-zinc-200">
                {bidMaxUsdcFromOrder(bid)} USDC
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-base text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-5 sm:top-5"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <CollectionCriteriaBidPanel
            variant="modal"
            collectionKey={collectionKey}
            activeAsks={activeAsks}
            connectedAddress={connectedAddress}
            bidToReplace={bid}
            bidOnlySubmit
            actionLayout="split"
            hideSellFooter
            onPlaced={() => {
              onUpdated?.();
              onClose();
            }}
            onPurchaseFilled={() => {
              onUpdated?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
