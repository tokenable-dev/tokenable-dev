"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppStore, selectWallet } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { getNftContractInfo, getNftBalance } from "@/lib/api";

export function NftInfo() {
  const { address } = useAppStore(useShallow(selectWallet));

  const { data: info, isLoading } = useQuery({
    queryKey: ["nft-contract-info"],
    queryFn: getNftContractInfo,
    refetchInterval: 30_000,
  });

  const { data: balance } = useQuery({
    queryKey: ["nft-balance", address],
    queryFn: () => getNftBalance(address!),
    enabled: !!address,
    refetchInterval: 30_000,
  });

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
          NFT
        </div>
        <h2 className="text-lg font-bold text-white">Tokenable_RWA</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm font-medium text-gray-200">{info?.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Symbol</span>
            <span className="text-sm font-medium text-gray-200">{info?.symbol}</span>
          </div>
          <div className="border-t border-gray-800 pt-3 flex justify-between items-center">
            <span className="text-sm text-gray-500">Total Minted</span>
            <span className="text-sm font-medium text-emerald-400">
              {info?.totalMinted ?? 0} NFTs
            </span>
          </div>
          {address && balance !== undefined && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">You Own</span>
              <span className="text-sm font-medium text-teal-400">{balance} NFTs</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
