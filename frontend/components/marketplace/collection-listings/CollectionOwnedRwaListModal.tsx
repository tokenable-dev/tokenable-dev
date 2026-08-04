"use client";

import type { Order } from "@/lib/core";
import { ListRwaModal } from "@/components/marketplace/list-rwa";
import { useCollectionOwnedRwaListModal } from "@/hooks/collection-listings";
import { CollectionOwnedRwaListAssetCard } from "./CollectionOwnedRwaListAssetCard";

export function CollectionOwnedRwaListModal({
  open,
  onClose,
  collectionKey,
  collectionLabel,
  collectionBids = [],
  listPricePresetUsdc,
  preferredBidOrderHash,
}: {
  open: boolean;
  onClose: () => void;
  collectionKey: string;
  collectionLabel: string;
  collectionBids?: Order[];
  listPricePresetUsdc?: string | null;
  preferredBidOrderHash?: string | null;
}) {
  const modal = useCollectionOwnedRwaListModal({ open, onClose, collectionKey });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-sell-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="relative z-[81] w-full max-w-2xl sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[min(94dvh,900px)] sm:max-h-[min(96vh,960px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#0b0e11] shadow-2xl overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-5 border-b border-gray-800/90 shrink-0">
          <div className="min-w-0">
            <h2
              id="collection-sell-modal-title"
              className="text-xl sm:text-2xl font-bold text-white truncate"
            >
              List in this collection
            </h2>
            <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">{collectionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-2 text-base text-gray-400 hover:text-white hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
          {!modal.effectiveAddr ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Connect your wallet to see assets.
            </p>
          ) : modal.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-[4/5] rounded-xl bg-gray-800/60 animate-pulse" />
              ))}
            </div>
          ) : !modal.rows?.length ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm text-gray-400">
                No owned RWAs match this collection&apos;s card bucket.
              </p>
              <p className="text-xs text-gray-600 max-w-sm mx-auto leading-relaxed">
                Collections are derived from graded metadata (PSA / Cardhedger fields). If you
                expected a match, check that this asset was minted with the same card + grade
                signature.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-5">
              {modal.rows.map((asset) => (
                <CollectionOwnedRwaListAssetCard
                  key={asset.tokenId}
                  asset={asset}
                  order={modal.activeByToken.get(asset.tokenId)}
                  cancellingHash={modal.cancellingHash}
                  onList={() => modal.setListingTokenId(asset.tokenId)}
                  onCancel={(order) => void modal.handleCancel(order)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal.listingTokenId != null && (
        <ListRwaModal
          tokenId={modal.listingTokenId}
          assetTitle={modal.listingAssetTitle}
          collectionKey={collectionKey}
          collectionBids={collectionBids}
          preferredBidOrderHash={preferredBidOrderHash ?? undefined}
          existingAskOrder={undefined}
          existingAskOrderHash={
            modal.listingAsk?.side === "ask" && modal.listingAsk.status === "active"
              ? modal.listingAsk.orderHash
              : undefined
          }
          initialPriceUsdc={listPricePresetUsdc ?? undefined}
          onClose={() => {
            modal.setListingTokenId(null);
            onClose();
          }}
          onListed={() => {
            modal.invalidateAfterList();
            // Keep sheet open for DS-4 complete state; Done closes via onClose.
          }}
        />
      )}
    </div>
  );
}
