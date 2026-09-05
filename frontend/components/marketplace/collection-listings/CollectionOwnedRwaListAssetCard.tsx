"use client";

import type { OrderListItem } from "@/lib/core";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";
import type { OwnedInCollection } from "@/hooks/collection-listings/useCollectionOwnedRwaListModal";

export function CollectionOwnedRwaListAssetCard({
  asset,
  order,
  cancellingHash,
  onList,
  onCancel,
}: {
  asset: OwnedInCollection;
  order: OrderListItem | undefined;
  cancellingHash: string | null;
  onList: () => void;
  onCancel: (order: OrderListItem) => void;
}) {
  const listed = !!order;
  const imageUrl = asset.imageUrl;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden flex flex-col shadow-lg">
      <div className="aspect-square bg-gray-800 relative p-3 sm:p-3.5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={asset.metadata?.name ?? `#${asset.tokenId}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No image
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-xs sm:text-xs text-gray-300 px-2 py-1 rounded-full">
          #{asset.tokenId}
        </div>
        {listed && (
          <div className="absolute top-2 right-2 bg-slate-600/90 text-xs sm:text-xs text-slate-100 px-2 py-1 rounded-full">
            Listed
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1 min-h-0">
        <p className="text-sm font-semibold text-white truncate leading-snug">
          {asset.metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${asset.tokenId}`}
        </p>
        <div className="mt-auto pt-3">
          {listed && order ? (
            <>
              <p className="text-xs text-mint/90 mb-2 font-medium tabular-nums">
                {(Number(order.price) / 1_000_000).toLocaleString()} USDC
              </p>
              <button
                type="button"
                onClick={onList}
                className="w-full py-2.5 text-xs font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-xl border border-mint-deep/35 mb-2"
              >
                Change price
              </button>
              <button
                type="button"
                disabled={cancellingHash === order.orderHash}
                onClick={() => onCancel(order)}
                className="w-full py-2.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-600/50 disabled:opacity-40"
              >
                {cancellingHash === order.orderHash ? "…" : "Cancel listing"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onList}
              className="w-full py-2.5 text-xs font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-xl border border-mint-deep/35"
            >
              List for sale
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
