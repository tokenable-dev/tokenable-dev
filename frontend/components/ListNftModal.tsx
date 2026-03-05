"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import {
  SKY_NFT_ADDRESS,
  MARKETPLACE_ADDRESS,
  SKY_NFT_APPROVE_ABI,
  MARKETPLACE_ABI,
} from "@/constants/contracts";
import { besu } from "@/config/wagmi";

type Step = "idle" | "approving" | "listing" | "confirming" | "success" | "error";

interface ListNftModalProps {
  tokenId: number;
  onClose: () => void;
  /** Called as soon as the list tx is submitted (optimistic) */
  onListed?: (tokenId: number) => void;
}

export function ListNftModal({ tokenId, onClose, onListed }: ListNftModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: besu.id });
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [listTxHash, setListTxHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();

  const { isLoading: waitingApprove } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    chainId: besu.id,
  });

  const { isLoading: waitingList } = useWaitForTransactionReceipt({
    hash: listTxHash,
    chainId: besu.id,
  });

  async function handleList() {
    if (!address || !price || parseFloat(price) <= 0) return;

    setErrorMsg("");
    try {
      // Step 1: Approve NFT to marketplace
      setStep("approving");
      const approveTx = await writeContractAsync({
        address: SKY_NFT_ADDRESS,
        abi: SKY_NFT_APPROVE_ABI,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, BigInt(tokenId)],
        chainId: besu.id,
      });
      setApproveTxHash(approveTx);

      // Step 2: List item on marketplace
      setStep("listing");
      const priceInUnits = parseUnits(price, 6);
      const listTx = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "listItem",
        args: [BigInt(tokenId), priceInUnits],
        chainId: besu.id,
      });
      setListTxHash(listTx);

      // Optimistic update — notify parent immediately so UI reflects listing
      onListed?.(tokenId);

      // Step 3: Wait for on-chain confirmation before refreshing backend data
      setStep("confirming");
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: listTx });
      }

      setStep("success");

      // Refetch after confirmation so backend data is fresh
      await queryClient.invalidateQueries({ queryKey: ["marketplace-listings"] });
      await queryClient.invalidateQueries({ queryKey: ["my-nft-ids", address] });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setStep("error");
    }
  }

  const isProcessing =
    step === "approving" || step === "listing" || step === "confirming";
  const isWaiting = waitingApprove || waitingList;

  const stepLabels: { label: string; active: boolean }[] = [
    { label: "1. Approve NFT", active: step === "approving" },
    { label: "2. List Item", active: step === "listing" },
    { label: "3. Confirming", active: step === "confirming" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors text-lg"
        >
          ✕
        </button>

        {step === "success" ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-bold text-white mb-1">Listing Successful!</h3>
            <p className="text-sm text-gray-400">
              NFT #{tokenId} is now listed for {price} USDC
            </p>
            {listTxHash && (
              <p className="text-xs font-mono text-blue-400 mt-2 break-all">
                {listTxHash}
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-5 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-1">
              List NFT #{tokenId} for Sale
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Set a price in USDC. You&apos;ll need to approve the marketplace first.
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1.5">
                Price (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  USDC
                </span>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex gap-2 mb-4">
              {stepLabels.map(({ label, active }) => (
                <div
                  key={label}
                  className={`flex-1 text-center text-xs py-1.5 rounded-lg ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {active && (isWaiting || step === "confirming") ? (
                    <span className="animate-pulse">{label}</span>
                  ) : (
                    label
                  )}
                </div>
              ))}
            </div>

            {step === "error" && errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-400 break-all">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={handleList}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
            >
              {isProcessing ? "Processing..." : "List for Sale"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
