"use client";

import { useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNftTokensByOwner,
  getNftTokenURI,
  getMarketplaceListings,
  fetchIpfsMetadata,
  resolveIpfsImage,
  type NftMetadata,
} from "@/lib/api";
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from "@/constants/contracts";
import { besu } from "@/config/wagmi";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectRefresh } from "@/store";
import { ListNftModal } from "@/components/marketplace/ListNftModal";

interface OwnedNft {
  tokenId: number;
  tokenURI: string;
  metadata: NftMetadata | null;
}

function NftCard({
  nft,
  isListed,
  listingPrice,
  onList,
  onCancel,
  isCancelling,
}: {
  nft: OwnedNft;
  isListed: boolean;
  listingPrice?: string;
  onList: (tokenId: number) => void;
  onCancel: (tokenId: number) => void;
  isCancelling: boolean;
}) {
  const imageUrl = nft.metadata?.image
    ? resolveIpfsImage(nft.metadata.image)
    : null;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors flex flex-col h-full">
      <div className="aspect-square bg-gray-800 relative overflow-hidden shrink-0">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={nft.metadata?.name ?? `NFT #${nft.tokenId}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No Image
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded-full pointer-events-none">
          #{nft.tokenId}
        </div>
        {isListed && (
          <div className="absolute top-2 right-2 bg-slate-600/80 text-xs text-slate-200 px-2 py-0.5 rounded-full pointer-events-none">
            Listed
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <p className="text-sm font-semibold text-white truncate">
          {nft.metadata?.name ?? `SkyNFT #${nft.tokenId}`}
        </p>
        {nft.metadata?.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {nft.metadata.description}
          </p>
        )}
        {isListed && listingPrice && (
          <p className="text-xs text-emerald-400/90 mt-1 font-medium">
            {parseFloat(listingPrice).toLocaleString()} USDC
          </p>
        )}
        <div className="mt-auto pt-3">
          {isListed ? (
            <button
              onClick={() => onCancel(nft.tokenId)}
              disabled={isCancelling}
              className="w-full py-2 text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 hover:text-slate-200 rounded-lg transition-colors border border-slate-600/60"
            >
              {isCancelling ? "Cancelling..." : "Cancel Listing"}
            </button>
          ) : (
            <button
              onClick={() => onList(nft.tokenId)}
              className="w-full py-2 text-xs font-medium bg-emerald-950/70 hover:bg-emerald-900/60 text-emerald-200 rounded-lg transition-colors border border-emerald-800/50"
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
  const publicClient = usePublicClient({ chainId: besu.id });
  const queryClient = useQueryClient();

  const [listingTokenId, setListingTokenId] = useState<number | null>(null);
  const [cancellingTokenId, setCancellingTokenId] = useState<number | null>(null);

  /**
   * Optimistic set: tokenIds that the user has just submitted a list tx for.
   * Added immediately on tx submit; cleared once the server query confirms listing.
   */
  const [pendingListedIds, setPendingListedIds] = useState<Set<number>>(new Set());

  /**
   * Optimistic set for cancellations — mirrors pendingListedIds in reverse.
   * Removed immediately on cancel tx submit.
   */
  const [pendingCancelledIds, setPendingCancelledIds] = useState<Set<number>>(new Set());

  const { writeContractAsync } = useWriteContract();

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

  const { data: listings } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: getMarketplaceListings,
    enabled: isConnected,
    refetchInterval: 15_000,
  });

  // Merge server listings with optimistic state
  const serverListedMap = new Map((listings ?? []).map((l) => [l.tokenId, l.price]));

  function isEffectivelyListed(tokenId: number): boolean {
    if (pendingCancelledIds.has(tokenId)) return false;
    return serverListedMap.has(tokenId) || pendingListedIds.has(tokenId);
  }

  function getListingPrice(tokenId: number): string | undefined {
    return serverListedMap.get(tokenId);
  }

  /** Called by ListNftModal as soon as the list tx is submitted */
  function handleOptimisticList(tokenId: number) {
    setPendingListedIds((prev) => new Set([...prev, tokenId]));
    // Remove from cancelled set in case of re-list after cancel
    setPendingCancelledIds((prev) => {
      const next = new Set(prev);
      next.delete(tokenId);
      return next;
    });
  }

  async function handleCancel(tokenId: number) {
    setCancellingTokenId(tokenId);
    // Optimistic update — immediately show as unlisted
    setPendingCancelledIds((prev) => new Set([...prev, tokenId]));
    setPendingListedIds((prev) => {
      const next = new Set(prev);
      next.delete(tokenId);
      return next;
    });

    try {
      const tx = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "cancelListing",
        args: [BigInt(tokenId)],
        chainId: besu.id,
      });

      // Wait for confirmation then sync backend
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      refresh();
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-nft-ids", address] });
    } catch (err) {
      // Rollback optimistic update on failure
      setPendingCancelledIds((prev) => {
        const next = new Set(prev);
        next.delete(tokenId);
        return next;
      });
      console.error("Cancel listing failed:", err);
    } finally {
      setCancellingTokenId(null);
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
        <p className="text-sm text-gray-600">
          Mint your first NFT from the Mint tab.
        </p>
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
            isListed={isEffectivelyListed(nft.tokenId)}
            listingPrice={getListingPrice(nft.tokenId)}
            onList={setListingTokenId}
            onCancel={handleCancel}
            isCancelling={cancellingTokenId === nft.tokenId}
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
