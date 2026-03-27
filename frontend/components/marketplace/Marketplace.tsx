"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getActiveOrders,
  getNftTokenURI,
  fetchIpfsMetadata,
  resolveIpfsImage,
  type Order,
} from "@/lib/api";
import { MarketplaceOrderBook } from "./MarketplaceOrderBook";

import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance } from "@/store";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";

// ── USDC balance banner ───────────────────────────────────────────────────────

function UsdcBalanceBanner() {
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));

  return (
    <div className="flex items-center justify-between mb-5 px-4 py-2.5 bg-gray-900/60 border border-gray-800 rounded-xl text-sm">
      <span className="text-gray-400">
        My USDC Balance:{" "}
        <span className="text-white font-semibold">
          {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
        </span>
      </span>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ml-4 px-3 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
      >
        Get Sepolia USDC →
      </a>
    </div>
  );
}

// ── Listing card ──────────────────────────────────────────────────────────────

function OrderCard({
  order,
  currentAddress,
}: {
  order: Order;
  currentAddress?: string;
}) {
  const tokenId = Number(order.tokenId);
  const priceUsdc = (Number(order.considerationAmount) / 1_000_000).toLocaleString();

  const { data: tokenURI } = useQuery({
    queryKey: ["nft-token-uri", tokenId],
    queryFn: () => getNftTokenURI(tokenId).catch(() => null),
    staleTime: 60_000,
    retry: false,
  });

  const { data: metadata } = useQuery({
    queryKey: ["nft-metadata", tokenId],
    queryFn: () =>
      tokenURI ? fetchIpfsMetadata(tokenURI) : Promise.resolve(null),
    enabled: !!tokenURI,
  });

  const imageUrl = metadata?.image ? resolveIpfsImage(metadata.image) : null;
  const isSelf =
    currentAddress?.toLowerCase() === order.offerer.toLowerCase();

  return (
    <Link href={`/marketplace/${tokenId}`} className="block group">
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden group-hover:border-gray-600 group-hover:shadow-lg group-hover:shadow-black/30 transition-all duration-200">
        <div className="aspect-square bg-gray-800 relative overflow-hidden p-2 sm:p-3">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={metadata?.name ?? `NFT #${tokenId}`}
              className="w-full h-full object-contain object-center"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
              No Image
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-0.5 rounded-full pointer-events-none">
            #{tokenId}
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center pointer-events-none">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
              View Details →
            </span>
          </div>
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-white truncate">
            {metadata?.name ?? `${TOKENABLE_RWA_DISPLAY_NAME} #${tokenId}`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {isSelf
              ? "Your listing"
              : `${order.offerer.slice(0, 6)}...${order.offerer.slice(-4)}`}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-bold text-mint">
                {priceUsdc}
              </span>
              <span className="text-xs text-mint-deep">USDC</span>
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

  const { data: orders, isLoading } = useQuery({
    queryKey: ["marketplace-orders"],
    queryFn: getActiveOrders,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="aspect-square bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!orders?.length) {
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
    <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 xl:items-start">
      <div className="flex-1 min-w-0 space-y-4">
        {isConnected && address && <UsdcBalanceBanner />}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.orderHash}
              order={order}
              currentAddress={address}
            />
          ))}
        </div>
      </div>
      <aside className="w-full xl:w-[min(340px,100%)] shrink-0 xl:sticky xl:top-4">
        <MarketplaceOrderBook orders={orders} />
      </aside>
    </div>
  );
}
