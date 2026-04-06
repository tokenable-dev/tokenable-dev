"use client";

import { useState, useEffect } from "react";
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
  TOKENABLE_RWA_APPROVE_ABI,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
} from "@/constants/contracts";
import { createOrder } from "@/lib/api";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

type Step =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "success"
  | "error";

interface ListRwaModalProps {
  tokenId: number;
  onClose: () => void;
  onListed?: (tokenId: number) => void;
  /** 풀 최대가로 재리스트할 때 가격 필드에 미리 채움 (예: "3.00") */
  initialPriceUsdc?: string | null;
}

export function ListRwaModal({
  tokenId,
  onClose,
  onListed,
  initialPriceUsdc,
}: ListRwaModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (initialPriceUsdc != null && initialPriceUsdc.trim() !== "") {
      setPrice(initialPriceUsdc.trim());
    }
  }, [initialPriceUsdc, tokenId]);

  const { writeContractAsync } = useWriteContract();

  // Seaport counter for the seller
  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  /** Prefetch so List click doesn’t block on RPC before the sign popup */
  const { data: approvedForNft } = useReadContract({
    address: TOKENABLE_RWA_ADDRESS,
    abi: TOKENABLE_RWA_APPROVE_ABI,
    functionName: "getApproved",
    args: [BigInt(tokenId)],
    chainId: sepolia.id,
    query: { enabled: Number.isFinite(tokenId) && tokenId >= 0 },
  });

  async function handleList() {
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
      const approvedRaw =
        approvedForNft ??
        (await publicClient.readContract({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_APPROVE_ABI,
          functionName: "getApproved",
          args: [BigInt(tokenId)],
        }));
      const needsNftApprove =
        (approvedRaw as string).toLowerCase() !== SEAPORT_ADDRESS.toLowerCase();

      // 서명과 병렬로 NFT approve 가스 추정 (두 번째 팝업 직전 대기 축소)
      const approveGasPromise = needsNftApprove
        ? gasWithCapFast(
            publicClient,
            {
              address: TOKENABLE_RWA_ADDRESS,
              abi: TOKENABLE_RWA_APPROVE_ABI,
              functionName: "approve",
              args: [SEAPORT_ADDRESS, BigInt(tokenId)],
              account: address,
            },
            GAS_FALLBACK.erc721Approve,
          )
        : Promise.resolve(null as bigint | null);

      setStep("signing");

      const orderMessage = {
        offerer: address,
        zone: ZERO_ADDRESS,
        offer: [
          {
            itemType: 2, // ERC721
            token: TOKENABLE_RWA_ADDRESS,
            identifierOrCriteria: BigInt(tokenId),
            startAmount: BigInt(1),
            endAmount: BigInt(1),
          },
        ],
        consideration: [
          {
            itemType: 1, // ERC20
            token: USDC_ADDRESS,
            identifierOrCriteria: BigInt(0),
            startAmount: priceInUnits,
            endAmount: priceInUnits,
            recipient: address,
          },
        ],
        orderType: 0, // FULL_OPEN
        startTime: now,
        endTime,
        zoneHash: ZERO_BYTES32,
        salt,
        conduitKey: ZERO_BYTES32,
        counter: counter as bigint,
      };

      const signature = await walletClient.signTypedData({
        account: address,
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

      if (needsNftApprove) {
        setStep("approving");
        const gasApprove = (await approveGasPromise) ?? GAS_FALLBACK.erc721Approve;
        await writeContractAsync({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_APPROVE_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, BigInt(tokenId)],
          chainId: sepolia.id,
          gas: gasApprove,
        });
      }

      // ── Step 2: POST to backend ───────────────────────────────────────────────
      setStep("submitting");

      const str = (v: unknown): string => String(v);

      await createOrder({
        side: "ask",
        parameters: {
          offerer: address,
          zone: ZERO_ADDRESS,
          zoneHash: ZERO_BYTES32,
          startTime: str(now),
          endTime: str(endTime),
          orderType: 0,
          offer: [
            {
              itemType: 2,
              token: TOKENABLE_RWA_ADDRESS,
              identifierOrCriteria: str(tokenId),
              startAmount: "1",
              endAmount: "1",
            },
          ],
          consideration: [
            {
              itemType: 1,
              token: USDC_ADDRESS,
              identifierOrCriteria: "0",
              startAmount: str(priceInUnits),
              endAmount: str(priceInUnits),
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
        considerationAmount: String(priceInUnits),
      });

      onListed?.(tokenId);
      setStep("success");

      void queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
      void queryClient.invalidateQueries({ queryKey: ["my-rwa-ids", address] });
    } catch (err: unknown) {
      setErrorMsg(mapWalletError(err).message);
      setStep("error");
    }
  }

  const isProcessing =
    step === "approving" || step === "signing" || step === "submitting";

  const stepLabels: { label: string; active: boolean }[] = [
    { label: "1. Sign order", active: step === "signing" },
    { label: "2. Approve (if needed)", active: step === "approving" },
    { label: "3. Submitting", active: step === "submitting" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
            <h3 className="text-lg font-bold text-white mb-1">Listed Successfully!</h3>
            <p className="text-sm text-gray-400">
              Asset #{tokenId} is now listed for {price} USDC
            </p>
            <p className="text-xs text-gray-600 mt-2">Listing valid for 30 days</p>
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
              List Asset #{tokenId} for Sale
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Set a price in USDC. Your asset will be listed via Seaport.
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
              onClick={() => void handleList()}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="w-full py-2.5 bg-gradient-to-r from-mint to-mint-dim hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-semibold rounded-lg transition-all"
            >
              {isProcessing ? "Processing..." : "List for Sale"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
