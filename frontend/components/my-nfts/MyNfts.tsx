"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNftTokensByOwner,
  getNftTokenURI,
  getActiveOrders,
  cancelOrder,
  fetchIpfsMetadata,
  resolveIpfsImage,
  type NftMetadata,
  type Order,
} from "@/lib/api";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectRefresh } from "@/store";
import { ListNftModal } from "@/components/marketplace/ListNftModal";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";

interface OwnedNft {
  tokenId: number;
  tokenURI: string;
  metadata: NftMetadata | null;
}

function NftCard({
  nft,
  activeOrder,
  onList,
  onCancel,
  isCancelling,
}: {
  nft: OwnedNft;
  activeOrder?: Order;
  onList: (tokenId: number) => void;
  onCancel: (order: Order) => void;
  isCancelling: boolean;
}) {
  const imageUrl = nft.metadata?.image
    ? resolveIpfsImage(nft.metadata.image)
    : null;

  const listingPrice = activeOrder
    ? (Number(activeOrder.considerationAmount) / 1_000_000).toLocaleString()
    : undefined;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors flex flex-col h-full">
      <div className="aspect-square bg-gray-800 relative overflow-hidden shrink-0 p-2 sm:p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={nft.metadata?.name ?? `NFT #${nft.tokenId}`}
            className="w-full h-full object-contain object-center"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No Image
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded-full pointer-events-none">
          #{nft.tokenId}
        </div>
        {activeOrder && (
          <div className="absolute top-2 right-2 bg-slate-600/80 text-xs text-slate-200 px-2 py-0.5 rounded-full pointer-events-none">
            Listed
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <p className="text-sm font-semibold text-white truncate">
          {nft.metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${nft.tokenId}`}
        </p>
        {nft.metadata?.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {nft.metadata.description}
          </p>
        )}
        {activeOrder && listingPrice && (
          <p className="text-xs text-mint/90 mt-1 font-medium">
            {listingPrice} USDC
          </p>
        )}
        <div className="mt-auto pt-3">
          {activeOrder ? (
            <button
              onClick={() => onCancel(activeOrder)}
              disabled={isCancelling}
              className="w-full py-2 text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-slate-200 rounded-lg transition-colors border border-slate-600/60"
            >
              {isCancelling ? "Cancelling..." : "Cancel Listing"}
            </button>
          ) : (
            <button
              onClick={() => onList(nft.tokenId)}
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

export function MyNfts() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const refresh = useAppStore(selectRefresh);
  const queryClient = useQueryClient();

  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [cancellingOrderHash, setCancellingOrderHash] = useState<string | null>(null);
  const [pendingListedIds, setPendingListedIds] = useState<Set<number>>(new Set());
  const [pendingCancelledHashes, setPendingCancelledHashes] = useState<Set<string>>(new Set());

  const { data: tokenIds, isLoading } = useQuery({
    queryKey: ["my-nft-ids", address],
    queryFn: () => getNftTokensByOwner(address!),
    enabled: !!address && isConnected,
  });

  const { data: nfts } = useQuery({
    queryKey: ["my-nfts", tokenIds],
    queryFn: async () => {
      if (!tokenIds?.length) return [];
      return Promise.all(
        tokenIds.map(async (tokenId): Promise<OwnedNft> => {
          try {
            const tokenURI = await getNftTokenURI(tokenId);
            const metadata = tokenURI
              ? await fetchIpfsMetadata(tokenURI).catch(() => null)
              : null;
            return { tokenId, tokenURI, metadata };
          } catch {
            return { tokenId, tokenURI: "", metadata: null };
          }
        })
      );
    },
    enabled: !!tokenIds?.length,
  });

  const { data: orders } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: getActiveOrders,
    enabled: isConnected,
    refetchInterval: 15_000,
  });

  // tokenId → Order マップ (active only, not pending cancel)
  const activeOrderMap = new Map<number, Order>();
  for (const order of orders ?? []) {
    if (
      order.status === "active" &&
      !pendingCancelledHashes.has(order.orderHash)
    ) {
      activeOrderMap.set(Number(order.tokenId), order);
    }
  }

  // pending listed IDs (optimistic)
  function getActiveOrder(tokenId: number): Order | undefined {
    if (pendingListedIds.has(tokenId) && !activeOrderMap.has(tokenId)) {
      return undefined; // will appear after refetch
    }
    return activeOrderMap.get(tokenId);
  }

  function handleOptimisticList(tokenId: number) {
    setPendingListedIds((prev) => new Set([...prev, tokenId]));
    setPendingCancelledHashes((prev) => {
      const next = new Set(prev);
      // Remove any cancelled hash associated with this tokenId
      orders
        ?.filter((o) => Number(o.tokenId) === tokenId)
        .forEach((o) => next.delete(o.orderHash));
      return next;
    });
  }

  async function handleCancel(order: Order) {
    if (!address) return;
    setCancellingOrderHash(order.orderHash);

    // Optimistic update
    setPendingCancelledHashes((prev) => new Set([...prev, order.orderHash]));
    setPendingListedIds((prev) => {
      const next = new Set(prev);
      next.delete(Number(order.tokenId));
      return next;
    });

    try {
      await cancelOrder(order.orderHash, address);
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["my-nft-ids", address] });
    } catch (err) {
      // Rollback on failure
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
        Connect your wallet to view your NFTs.
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

  if (!nfts?.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-2">You don&apos;t own any NFTs yet.</p>
        <p className="text-sm text-gray-600">Mint your first NFT from the Mint tab.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
        {nfts.map((nft) => (
          <NftCard
            key={nft.tokenId}
            nft={nft}
            activeOrder={getActiveOrder(nft.tokenId)}
            onList={setListingTokenId}
            onCancel={handleCancel}
            isCancelling={
              cancellingOrderHash === (activeOrderMap.get(nft.tokenId)?.orderHash ?? "")
            }
          />
        ))}
      </div>

      {listingTokenId !== null && (
        <ListNftModal
          tokenId={listingTokenId}
          onClose={() => setListingTokenId(null)}
          onListed={handleOptimisticList}
        />
      )}
    </>
  );
}
