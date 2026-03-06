"use client";

import { useAccount } from "wagmi";
import { besu } from "@/config/wagmi";
import { MintForm } from "@/components/mint/MintForm";

export function NftMintForm() {
  const { isConnected, chain } = useAccount();
  const isWrongNetwork = isConnected && chain?.id !== besu.id;

  if (!isConnected) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="text-gray-400">Connect your wallet to mint graded card NFTs</p>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="bg-gray-900/50 border border-red-800/50 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-red-400 font-medium">Wrong Network</p>
        <p className="text-gray-500 text-sm mt-1">
          Please switch MetaMask to the Besu network (Chain ID: 2741)
        </p>
      </div>
    );
  }

  return <MintForm />;
}
