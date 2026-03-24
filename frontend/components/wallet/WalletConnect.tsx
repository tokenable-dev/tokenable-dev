"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import { ensureSepoliaNetwork } from "@/lib/ensureSepoliaNetwork";

export function WalletConnect() {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });
  const [isSwitching, setIsSwitching] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== sepolia.id;

  async function handleSwitchToSepolia() {
    if (!connector) return;
    setIsSwitching(true);
    try {
      const provider = await connector.getProvider() as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (provider?.request) {
        await ensureSepoliaNetwork(
          provider as Parameters<typeof ensureSepoliaNetwork>[0]
        );
      }
    } finally {
      setIsSwitching(false);
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          {isWrongNetwork && (
            <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-full">
              Wrong Network
            </span>
          )}
          <div className="text-right">
            <p className="text-sm font-mono text-gray-300">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            {balance && (
              <p className="text-xs text-gray-500">
                {parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)}{" "}
                {balance.symbol}
              </p>
            )}
          </div>
          <div
            className={`w-2 h-2 rounded-full ${isWrongNetwork ? "bg-red-400" : "bg-green-400"}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {isWrongNetwork && (
            <button
              onClick={() => void handleSwitchToSepolia()}
              disabled={isSwitching}
              className="text-xs px-2 py-1 bg-emerald-600/80 hover:bg-emerald-500/80 disabled:opacity-50 text-white rounded transition-colors"
            >
              {isSwitching ? "Switching..." : "Switch to Sepolia"}
            </button>
          )}
          <button
            onClick={() => disconnect()}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  const metaMaskConnector = connectors.find((c) => c.name === "MetaMask");

  return (
    <button
      onClick={() => metaMaskConnector && connect({ connector: metaMaskConnector })}
      disabled={isPending || !metaMaskConnector}
      className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-orange-500/20"
    >
      {isPending ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}
