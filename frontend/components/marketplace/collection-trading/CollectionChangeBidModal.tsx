"use client";

import type { Order } from "@/lib/core";
import { bidMaxUsdcFromOrder } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { CollectionListingBidCheckout } from "@/components/marketplace/collection-detail/CollectionListingBidCheckout";
import { normalizeDecimalTokenId } from "@/lib/marketplace";
import {
  formatListingUsdc,
  stubListingForOffer,
} from "@/lib/marketplace/collectionListingModalHelpers";

export function CollectionChangeBidModal({
  open,
  bid,
  collectionKey,
  activeAsks,
  collectionBids = [],
  connectedAddress,
  mode = "change",
  onClose,
  onUpdated,
}: {
  open: boolean;
  bid: Order | null;
  collectionKey: string;
  activeAsks: Order[];
  collectionBids?: Order[];
  connectedAddress?: string;
  /** "rebid" = place a new bid after expiry (no replace). */
  mode?: "change" | "rebid";
  onClose: () => void;
  onUpdated?: () => void;
}) {
  if (!open || bid == null) return null;

  const tokenId = normalizeDecimalTokenId(bid.tokenId);
  const tokenIdNum = Number(tokenId);
  const listing =
    activeAsks.find(
      (a) =>
        a.status === "active" &&
        String(a.side ?? "ask").toLowerCase() !== "bid" &&
        normalizeDecimalTokenId(a.tokenId) === tokenId,
    ) ??
    stubListingForOffer(
      Number.isFinite(tokenIdNum) ? tokenIdNum : 0,
      collectionKey,
    );

  const listedLabel =
    listing.id !== 0
      ? `${formatListingUsdc(listing.considerationAmount)}.00`
      : null;

  const replaceBid = bid.status === "active" ? bid : null;
  const title = mode === "rebid" ? "Re-bid" : "Change bid price";
  const subtitleLabel = mode === "rebid" ? "Previous bid" : "Current bid";

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
        aria-labelledby="collection-change-bid-title"
        className="relative flex max-h-[min(88svh,520px)] w-full max-w-[min(calc(100vw-2rem),26rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-xl shadow-black/40"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/90 px-5 py-5 sm:px-6">
          <div className="min-w-0 pr-8">
            <h2
              id="collection-change-bid-title"
              className="text-xl font-bold tracking-tight text-white sm:text-2xl"
            >
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-snug text-zinc-400">
              {subtitleLabel}:{" "}
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
          <CollectionListingBidCheckout
            collectionKey={collectionKey}
            tokenId={tokenId}
            listing={listing}
            collectionBids={collectionBids}
            listedPriceLabel={listedLabel}
            connectedAddress={connectedAddress}
            bidToReplace={replaceBid}
            onPlaced={() => {
              onUpdated?.();
              onClose();
            }}
            onPurchaseFilled={() => {
              onUpdated?.();
              onClose();
            }}
            onDone={onClose}
          />
        </div>
      </div>
    </div>
  );
}
