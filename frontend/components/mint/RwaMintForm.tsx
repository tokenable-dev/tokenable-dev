"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { sepolia } from "@/config/wagmi";
import { MintForm } from "./MintForm";
import { ensureSepoliaNetwork } from "@/lib/ensureSepoliaNetwork";

export function RwaMintForm() {
  const { isConnected, chain, connector } = useAccount();
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

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-400">Connect your wallet to mint graded card assets</p>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="bg-gray-900/50 border border-red-800/50 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 font-medium">Wrong Network</p>
        <p className="text-gray-500 text-sm mt-1">
          Please switch to Ethereum Sepolia (Chain ID: 11155111)
        </p>
        <button
          onClick={() => void handleSwitchToSepolia()}
          disabled={isSwitching}
          className="mt-4 px-4 py-2 bg-mint-dim/90 hover:brightness-110 disabled:opacity-50 text-mint-ink text-sm font-medium rounded-lg transition-colors"
        >
          {isSwitching ? "Switching..." : "Switch to Sepolia"}
        </button>
      </div>
    );
  }

  return <MintForm />;
}
