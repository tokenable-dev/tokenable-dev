"use client";

import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { useAppStore, selectWallet, selectUsdcBalance } from "@/store";
import { getTokenInfo, getTokenSupply } from "@/lib/api";

export function TokenInfo() {
  // Address & balance come from the Zustand store (kept in sync by
  // WalletDataProvider), so they update immediately after any transaction.
  const { address } = useAppStore(useShallow(selectWallet));
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["token-info"],
    queryFn: getTokenInfo,
    // Token name / symbol / decimals never change — no polling needed
    staleTime: Infinity,
  });

  const { data: supply, isLoading: supplyLoading } = useQuery({
    queryKey: ["token-supply"],
    queryFn: getTokenSupply,
    refetchInterval: 30_000,
  });

  const isLoading = infoLoading || supplyLoading;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-mint to-mint-dim rounded-lg flex items-center justify-center text-xs font-bold text-mint-ink">
          $
        </div>
        <h2 className="text-lg font-bold text-white">USD Coin (USDC)</h2>
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
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Decimals</span>
            <span className="text-sm font-medium text-gray-200">{info?.decimals}</span>
          </div>
          <div className="border-t border-gray-800 pt-3 flex justify-between items-center">
            <span className="text-sm text-gray-500">Total Supply</span>
            <span className="text-sm font-medium text-mint">
              {supply ? parseFloat(supply).toLocaleString() : "-"} USDC
            </span>
          </div>
          {address && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Your Balance</span>
              <span className="text-sm font-medium text-mint">
                {parseFloat(usdcBalanceFormatted).toLocaleString()} USDC
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
