"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  getRwaTokenURI,
  fetchIpfsMetadata,
  resolveIpfsImage,
  type Order,
} from "@/lib/api";
import { TOKENABLE_RWA_DISPLAY_NAME } from "@/constants/contracts";

export function MarketplaceOrderCard({
  order,
  currentAddress,
}: {
  order: Order;
  currentAddress?: string;
}) {
  const tokenId = Number(order.tokenId);
  const priceUsdc = (Number(order.considerationAmount) / 1_000_000).toLocaleString();

  const { data: tokenURI } = useQuery({
    queryKey: ["rwa-token-uri", tokenId],
    queryFn: () => getRwaTokenURI(tokenId).catch(() => null),
    staleTime: 60_000,
    retry: false,
  });

  const { data: metadata } = useQuery({
    queryKey: ["rwa-metadata", tokenId],
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
              alt={metadata?.name ?? `Asset #${tokenId}`}
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
