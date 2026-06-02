"use client";

import {
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import type { Order } from "@/lib/core";
import {
  askPriceMicros,
  formatCriteriaBidUsdc6,
} from "@/lib/seaport/criteria/collectionCriteriaBidAsk";

export function CollectionCriteriaBidFloorChooserModal({
  open,
  lowestAskCandidates,
  lowestAsk,
  lowestAskUsdc,
  floorMetaByTokenId,
  busy,
  onClose,
  onSelectAskHash,
  onConfirmBuy,
}: {
  open: boolean;
  lowestAskCandidates: Order[];
  lowestAsk: Order | null;
  lowestAskUsdc: string | null;
  floorMetaByTokenId: Map<number, { name?: string; imageUrl: string | null }>;
  busy: boolean;
  onClose: () => void;
  onSelectAskHash: (hash: string) => void;
  onConfirmBuy: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close card chooser"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative z-[131] w-full max-w-3xl rounded-2xl ${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-950 p-4 sm:p-5`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white sm:text-lg">Choose card to buy</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {lowestAskCandidates.length} cards at {lowestAskUsdc ?? "floor"} USDC.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-3">
          {lowestAskCandidates.map((o) => {
            const tokenId = Number(o.tokenId);
            const meta = floorMetaByTokenId.get(tokenId);
            const selected = lowestAsk?.orderHash === o.orderHash;
            return (
              <button
                key={o.orderHash}
                type="button"
                onClick={() => onSelectAskHash(o.orderHash)}
                className={`rounded-xl p-2 text-left transition-colors ${
                  selected
                    ? "border border-mint/45 bg-mint/[0.10]"
                    : `${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-900/60 hover:border-zinc-500/80`
                }`}
              >
                <div
                  className={`aspect-square overflow-hidden rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-900`}
                >
                  {meta?.imageUrl ? (
                    <img
                      src={meta.imageUrl}
                      alt={meta?.name ?? `Token #${tokenId}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">
                      #{tokenId}
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-xs font-semibold text-zinc-200">
                  {meta?.name ?? `Token #${tokenId}`}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  #{tokenId} · {formatCriteriaBidUsdc6(String(askPriceMicros(o)))} USDC
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md ${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-900/70 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmBuy}
            disabled={busy || !lowestAsk}
            className="flex-1 rounded-md bg-mint-deep px-3 py-2 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Buying…" : `Buy selected · ${lowestAskUsdc ?? "USDC"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
