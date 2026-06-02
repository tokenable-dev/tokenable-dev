"use client";

import { ListRwaModalSuccessView } from "@/components/marketplace/list-rwa/ListRwaModalSuccessView";
import type { ListSuccessMeta } from "@/lib/seaport/listing/listRwaModalTypes";

/** Listing flow success — overlay modal with explicit close (price update / new list / instant match). */
export function ListRwaSuccessModal({
  open,
  tokenId,
  price,
  isReplaceListing,
  successMeta,
  onClose,
}: {
  open: boolean;
  tokenId: number;
  price: string;
  isReplaceListing: boolean;
  successMeta: ListSuccessMeta | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="list-rwa-success-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-[min(100%,22rem)] flex-col rounded-2xl border border-zinc-700/90 bg-zinc-950 px-6 py-6 shadow-xl shadow-black/40 sm:py-8">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-4 sm:top-4"
        >
          ✕
        </button>
        <ListRwaModalSuccessView
          tokenId={tokenId}
          price={price}
          isReplaceListing={isReplaceListing}
          successMeta={successMeta}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
