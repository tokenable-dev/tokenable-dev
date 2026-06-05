"use client";

import dynamic from "next/dynamic";
import type { Order } from "@/lib/core";
import { rwaDetailRightFont } from "../theme";

const CollectionCriteriaBidPanel = dynamic(
  () =>
    import("@/components/marketplace/collection-criteria-bid").then((m) => ({
      default: m.CollectionCriteriaBidPanel,
    })),
  { ssr: false },
);

export function RwaDetailPlaceBidModal({
  open,
  assetTitle,
  collectionKey,
  collectionAsks,
  connectedAddress,
  hasActiveListing,
  onClose,
  onPlaced,
  onPurchaseFilled,
}: {
  open: boolean;
  assetTitle: string;
  collectionKey: string;
  collectionAsks: Order[];
  connectedAddress?: string;
  hasActiveListing: boolean;
  onClose: () => void;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6 sm:py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rwa-place-bid-title"
        className={`relative flex max-h-[min(88svh,520px)] w-full max-w-[min(100%,26rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-xl shadow-black/40 ${rwaDetailRightFont.className}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/90 px-5 py-5 sm:px-6">
          <div className="min-w-0 pr-8">
            <h2
              id="rwa-place-bid-title"
              className="text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              Place bid
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-zinc-400">
              {assetTitle}
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
            activeAsks={collectionAsks}
            connectedAddress={connectedAddress}
            bidOnlySubmit={hasActiveListing}
            actionLayout="split"
            hideSellFooter
            onPlaced={() => onPlaced?.()}
            onPurchaseFilled={() => onPurchaseFilled?.()}
          />
        </div>
      </div>
    </div>
  );
}
