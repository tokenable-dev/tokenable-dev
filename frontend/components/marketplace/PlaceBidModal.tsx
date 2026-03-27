"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  USDC_ABI,
} from "@/constants/contracts";
import { createOrder } from "@/lib/api";
import { gasWithCap } from "@/lib/chainGas";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;

type Step =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "success"
  | "error";

interface PlaceBidModalProps {
  tokenId: number;
  onClose: () => void;
  onPlaced?: (tokenId: number) => void;
}

export function PlaceBidModal({ tokenId, onClose, onPlaced }: PlaceBidModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { writeContractAsync } = useWriteContract();

  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  async function handlePlaceBid() {
    if (!address || !price || parseFloat(price) <= 0) return;
    if (counter === undefined) {
      setErrorMsg("Could not read Seaport counter. Try again.");
      return;
    }
    if (!walletClient) {
      setErrorMsg("Wallet not connected. Please reconnect.");
      return;
    }
    if (!publicClient) {
      setErrorMsg("Network not ready. Try again.");
      return;
    }

    setErrorMsg("");
    const priceInUnits = parseUnits(price, 6);
    const now = BigInt(Math.floor(Date.now() / 1000));
    const endTime = now + BigInt(ORDER_DURATION_SECONDS);
    const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

    try {
      setStep("approving");
      const gasApprove = await gasWithCap(publicClient, {
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, priceInUnits],
        account: address,
      });
      const approveTx = await writeContractAsync({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "approve",
        args: [SEAPORT_ADDRESS, priceInUnits],
        chainId: sepolia.id,
        gas: gasApprove,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setStep("signing");

      const orderMessage = {
        offerer: address,
        zone: ZERO_ADDRESS,
        offer: [
          {
            itemType: 1,
            token: USDC_ADDRESS,
            identifierOrCriteria: BigInt(0),
            startAmount: priceInUnits,
            endAmount: priceInUnits,
          },
        ],
        consideration: [
          {
            itemType: 2,
            token: TOKENABLE_RWA_ADDRESS,
            identifierOrCriteria: BigInt(tokenId),
            startAmount: BigInt(1),
            endAmount: BigInt(1),
            recipient: address,
          },
        ],
        orderType: 0,
        startTime: now,
        endTime,
        zoneHash: ZERO_BYTES32,
        salt,
        conduitKey: ZERO_BYTES32,
        counter,
      };

      const signature = await walletClient.signTypedData({
        domain: {
          name: "Seaport",
          version: "1.5",
          chainId: sepolia.id,
          verifyingContract: SEAPORT_ADDRESS,
        },
        types: SEAPORT_ORDER_TYPES,
        primaryType: "OrderComponents",
        message: orderMessage,
      });

      setStep("submitting");

      const str = (v: unknown): string => String(v);

      await createOrder({
        side: "bid",
        parameters: {
          offerer: address,
          zone: ZERO_ADDRESS,
          zoneHash: ZERO_BYTES32,
          startTime: str(now),
          endTime: str(endTime),
          orderType: 0,
          offer: [
            {
              itemType: 1,
              token: USDC_ADDRESS,
              identifierOrCriteria: "0",
              startAmount: str(priceInUnits),
              endAmount: str(priceInUnits),
            },
          ],
          consideration: [
            {
              itemType: 2,
              token: TOKENABLE_RWA_ADDRESS,
              identifierOrCriteria: str(tokenId),
              startAmount: "1",
              endAmount: "1",
              recipient: address,
            },
          ],
          totalOriginalConsiderationItems: 1,
          salt: str(salt),
          conduitKey: ZERO_BYTES32,
          counter: str(counter),
        },
        signature,
        tokenContract: TOKENABLE_RWA_ADDRESS,
        tokenId: String(tokenId),
        considerationToken: USDC_ADDRESS,
        considerationAmount: str(priceInUnits),
      });

      onPlaced?.(tokenId);
      setStep("success");

      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-bids", tokenId] });
      await queryClient.invalidateQueries({ queryKey: ["nft-activity", tokenId] });
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-order-by-token", tokenId],
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setStep("error");
    }
  }

  const isProcessing =
    step === "approving" || step === "signing" || step === "submitting";

  const stepLabels: { label: string; active: boolean }[] = [
    { label: "1. Approve USDC", active: step === "approving" },
    { label: "2. Sign bid", active: step === "signing" },
    { label: "3. Submit", active: step === "submitting" },
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
            <div className="text-4xl mb-3">✓</div>
            <h3 className="text-lg font-bold text-white mb-1">Bid placed</h3>
            <p className="text-sm text-gray-400">
              Your bid of {price} USDC for NFT #{tokenId} is live on the order book.
            </p>
            <p className="text-xs text-gray-600 mt-2">Valid for 30 days</p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-1">Place a bid</h2>
            <p className="text-sm text-gray-500 mb-5">
              Offer USDC for this NFT. The seller can accept your bid on-chain (Seaport).
            </p>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1.5">
                Bid price (USDC)
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
                  className="w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  USDC
                </span>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              {stepLabels.map(({ label, active }) => (
                <div
                  key={label}
                  className={`flex-1 text-center text-xs py-1.5 rounded-lg ${
                    active
                      ? "bg-mint-dim text-mint-ink animate-pulse"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {step === "error" && errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-400 break-all">{errorMsg}</p>
              </div>
            )}

            <button
              onClick={() => void handlePlaceBid()}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="w-full py-2.5 bg-gradient-to-r from-mint to-mint-dim hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-semibold rounded-lg transition-all"
            >
              {isProcessing ? "Processing…" : "Place bid"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
