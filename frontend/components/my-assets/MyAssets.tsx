"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMarketplaceCollectionDetail,
  cancelOrder,
  type RwaMetadata,
  type OrderListItem,
} from "@/lib/core";
import {
  computeMarketBucketKey,
  extractBucketComponentsFromMetadata,
} from "@/lib/marketplace/bucketKey";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectRefresh } from "@/store";
import { ListRwaModal } from "@/components/marketplace/ListRwaModal";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";
import { useUserAssets } from "@/hooks/useUserAssets";
import { rq } from "@/lib/core";

interface OwnedRwa {
  tokenId: number;
  tokenURI: string;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
}

function RwaCard({
  asset,
  activeOrder,
  onList,
  onCancel,
  isCancelling,
}: {
  asset: OwnedRwa;
  activeOrder?: OrderListItem;
  onList: (tokenId: number) => void;
  onCancel: (order: OrderListItem) => void;
  isCancelling: boolean;
}) {
  const imageUrl = asset.imageUrl;

  const listingPrice = activeOrder
    ? (Number(activeOrder.price) / 1_000_000).toLocaleString()
    : undefined;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors flex flex-col h-full">
      <div className="aspect-square bg-gray-800 relative overflow-hidden shrink-0 p-2 sm:p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={asset.metadata?.name ?? `Asset #${asset.tokenId}`}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No Image
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded-full pointer-events-none">
          #{asset.tokenId}
        </div>
        {activeOrder && (
          <div className="absolute top-2 right-2 bg-slate-600/80 text-xs text-slate-200 px-2 py-0.5 rounded-full pointer-events-none">
            Listed
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <p className="text-sm font-semibold text-white truncate">
          {asset.metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${asset.tokenId}`}
        </p>
        {asset.metadata?.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {asset.metadata.description}
          </p>
        )}
        {activeOrder && listingPrice && (
          <p className="text-xs text-mint/90 mt-1 font-medium">
            {listingPrice} USDC
          </p>
        )}
        <div className="mt-auto pt-3 flex flex-col gap-2">
          {activeOrder ? (
            <>
              <button
                type="button"
                onClick={() => onList(asset.tokenId)}
                className="w-full py-2 text-xs font-semibold bg-mint/10 hover:bg-mint/15 text-mint rounded-lg transition-colors border border-mint-deep/35"
              >
                Change price
              </button>
              <button
                type="button"
                onClick={() => onCancel(activeOrder)}
                disabled={isCancelling}
                className="w-full py-2 text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-slate-200 rounded-lg transition-colors border border-slate-600/60"
              >
                {isCancelling ? "Cancelling..." : "Cancel listing"}
              </button>
            </>
          ) : (
            <button
              onClick={() => onList(asset.tokenId)}
              className="w-full py-2 text-xs font-medium bg-mint/10 hover:bg-mint/15 text-mint rounded-lg transition-colors border border-mint-deep/35"
            >
              List for Sale
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MyAssets() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const refresh = useAppStore(selectRefresh);
  const queryClient = useQueryClient();

  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [cancellingOrderHash, setCancellingOrderHash] = useState<string | null>(null);
  const [pendingListedIds, setPendingListedIds] = useState<Set<number>>(new Set());
  const [pendingCancelledHashes, setPendingCancelledHashes] = useState<Set<string>>(new Set());

  const {
    tokenIds,
    assets: hookAssets,
    activeOrders: orders,
    isLoadingIds: isLoading,
  } = useUserAssets(isConnected ? address : undefined, {
    enabled: Boolean(address && isConnected),
    includeOrderHistory: false,
    includeMarketPreview: false,
  });

  const assets: OwnedRwa[] = useMemo(
    () =>
      hookAssets.map((a) => ({
        tokenId: a.tokenId,
        tokenURI: "",
        metadata: a.metadata,
        imageUrl: a.imageUrl,
      })),
    [hookAssets],
  );

  const listingAsset = useMemo(() => {
    if (listingTokenId == null || !assets?.length) return null;
    return assets.find((a) => a.tokenId === listingTokenId) ?? null;
  }, [listingTokenId, assets]);

  const { data: listModalCollectionKey } = useQuery({
    queryKey: ["metadata-bucket-key-owned", listingTokenId, listingAsset?.metadata],
    queryFn: async () => {
      const meta = listingAsset?.metadata;
      if (!meta) return null;
      const c = extractBucketComponentsFromMetadata(meta as Record<string, unknown>);
      if (!c) return null;
      return await computeMarketBucketKey(c);
    },
    enabled: listingTokenId != null && !!listingAsset?.metadata,
  });

  const { data: listModalCollectionDetail } = useQuery({
    queryKey: ["marketplace-collection", listModalCollectionKey],
    queryFn: () => getMarketplaceCollectionDetail(listModalCollectionKey!),
    enabled: !!listModalCollectionKey,
    staleTime: 15_000,
  });

  const activeOrderMap = new Map<number, OrderListItem>();
  for (const order of orders ?? []) {
    if (
      order.status === "active" &&
      order.side === "ask" &&
      !pendingCancelledHashes.has(order.orderHash)
    ) {
      activeOrderMap.set(Number(order.tokenId), order);
    }
  }

  function getActiveOrder(tokenId: number): OrderListItem | undefined {
    if (pendingListedIds.has(tokenId) && !activeOrderMap.has(tokenId)) {
      return undefined;
    }
    return activeOrderMap.get(tokenId);
  }

  function handleOptimisticList(tokenId: number) {
    setPendingListedIds((prev) => new Set([...prev, tokenId]));
    setPendingCancelledHashes((prev) => {
      const next = new Set(prev);
      orders
        ?.filter((o) => Number(o.tokenId) === tokenId)
        .forEach((o) => next.delete(o.orderHash));
      return next;
    });
  }

  async function handleCancel(order: OrderListItem) {
    if (!address) return;
    setCancellingOrderHash(order.orderHash);

    setPendingCancelledHashes((prev) => new Set([...prev, order.orderHash]));
    setPendingListedIds((prev) => {
      const next = new Set(prev);
      next.delete(Number(order.tokenId));
      return next;
    });

    try {
      await cancelOrder(order.orderHash, address);
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: rq.rwaTokens(address) });
    } catch (err) {
      setPendingCancelledHashes((prev) => {
        const next = new Set(prev);
        next.delete(order.orderHash);
        return next;
      });
      console.error("Cancel listing failed:", err);
    } finally {
      setCancellingOrderHash(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center py-16 text-gray-500">
        Connect your wallet to view your assets.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!assets?.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-2">You don&apos;t own any assets yet.</p>
        <p className="text-sm text-gray-600">Mint your first asset from the Mint tab.</p>
      </div>
    );
  }

  const listingAsk = listingTokenId != null ? activeOrderMap.get(listingTokenId) : undefined;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
        {assets.map((asset) => (
          <RwaCard
            key={asset.tokenId}
            asset={asset}
            activeOrder={getActiveOrder(asset.tokenId)}
            onList={setListingTokenId}
            onCancel={handleCancel}
            isCancelling={
              cancellingOrderHash === (activeOrderMap.get(asset.tokenId)?.orderHash ?? "")
            }
          />
        ))}
      </div>

      {listingTokenId !== null && (
        <ListRwaModal
          tokenId={listingTokenId}
          collectionKey={listModalCollectionKey ?? undefined}
          collectionBids={listModalCollectionDetail?.collectionBids ?? []}
          existingAskOrder={undefined}
          existingAskOrderHash={
            listingAsk?.side === "ask" && listingAsk.status === "active"
              ? listingAsk.orderHash
              : undefined
          }
          onClose={() => setListingTokenId(null)}
          onListed={handleOptimisticList}
        />
      )}
    </>
  );
}
