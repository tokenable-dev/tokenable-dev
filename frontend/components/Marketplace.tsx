"use client";

import { useState } from "react";
import Link from "next/link";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMarketplaceListings,
  fetchIpfsMetadata,
  resolveIpfsImage,
  type MarketplaceListing,
} from "@/lib/api";
import { NftImageZoom } from "./NftImageZoom";
import { USDC_ADDRESS, MARKETPLACE_ADDRESS, USDC_ABI, MARKETPLACE_ABI } from "@/constants/contracts";
import { besu } from "@/config/wagmi";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance, selectRefresh } from "@/store";

const FAUCET_AMOUNT = parseUnits("10000", 6); // 10,000 USDC

// ── USDC balance banner ───────────────────────────────────────────────────────

function UsdcBalanceBanner({
  onFaucet,
  isMinting,
}: {
  onFaucet: () => void;
  isMinting: boolean;
}) {
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));

  return (
    <div className="flex items-center justify-between mb-5 px-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-sm">
      <span className="text-gray-400">
        My USDC Balance:{" "}
        <span className="text-white font-semibold">
          {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
        </span>
      </span>
      <button
        onClick={onFaucet}
        disabled={isMinting}
        className="ml-4 px-3 py-1 text-xs font-semibold bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
      >
        {isMinting ? "Getting USDC..." : "Get 10,000 USDC"}
      </button>
    </div>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  currentAddress,
}: {
  listing: MarketplaceListing;
  currentAddress?: string;
}) {
  const { data: metadata } = useQuery({
    queryKey: ["nft-metadata", listing.tokenId],
    queryFn: () =>
      listing.tokenURI ? fetchIpfsMetadata(listing.tokenURI) : Promise.resolve(null),
    enabled: !!listing.tokenURI,
  });

  const imageUrl = metadata?.image ? resolveIpfsImage(metadata.image) : null;
  const isSelf = currentAddress?.toLowerCase() === listing.seller.toLowerCase();

  return (
    <Link href={`/marketplace/${listing.tokenId}`} className="block group">
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden group-hover:border-gray-600 group-hover:shadow-lg group-hover:shadow-black/30 transition-all duration-200">
        <div className="aspect-square bg-gray-800 relative overflow-hidden">
          {imageUrl ? (
            <NftImageZoom
              src={imageUrl}
              alt={metadata?.name ?? `NFT #${listing.tokenId}`}
              className="w-full h-full"
              zoomFactor={2.5}
              lensSize={140}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
              No Image
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded-full pointer-events-none">
            #{listing.tokenId}
          </div>
          {/* Hover overlay — pointer-events-none so image zoom receives hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              View Details →
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-white truncate">
            {metadata?.name ?? `SkyNFT #${listing.tokenId}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {isSelf ? "Your listing" : `${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-green-400">
                {parseFloat(listing.price).toLocaleString()}
              </span>
              <span className="text-xs text-green-600">USDC</span>
            </div>
            <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
              {isSelf ? "Cancel →" : "Buy →"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Marketplace ───────────────────────────────────────────────────────────────

export function Marketplace() {
  const { address, isConnected } = useAppStore(useShallow(selectWallet));
  const refresh = useAppStore(selectRefresh);

  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [isMintingUsdc, setIsMintingUsdc] = useState(false);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();

  useWaitForTransactionReceipt({ hash: approveTxHash, chainId: besu.id });

  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: getMarketplaceListings,
    refetchInterval: 15_000,
  });

  async function handleFaucet() {
    if (!address) return;
    setIsMintingUsdc(true);
    try {
      await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "mint",
        args: [address, FAUCET_AMOUNT],
        chainId: besu.id,
      });
      refresh();
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
    } catch (err) {
      console.error("Faucet failed:", err);
    } finally {
      setIsMintingUsdc(false);
    }
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

  if (!listings?.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-2">No NFTs listed for sale yet.</p>
        <p className="text-sm text-gray-600">
          Mint and list your NFTs from the My NFTs tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      {isConnected && address && (
        <UsdcBalanceBanner
          onFaucet={() => void handleFaucet()}
          isMinting={isMintingUsdc}
        />
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {listings.map((listing) => (
          <ListingCard
            key={listing.tokenId}
            listing={listing}
            currentAddress={address}
          />
        ))}
      </div>
    </div>
  );
}
