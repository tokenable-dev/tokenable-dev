"use client";

import { useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  USDC_ABI,
} from "@/constants/contracts";
import { createOrder, preparePoolBidFulfillment } from "@/lib/api";
import { gasWithCap } from "@/lib/chainGas";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

type Step = "idle" | "approving" | "signing" | "submitting" | "success" | "error";

interface SignPoolBidSeaportProps {
  tokenId: number;
  poolBidId: number;
  onDone: () => void;
}

/**
 * 풀(컬렉션) 매수자가 특정 tokenId에 대해 Seaport 입찰을 서명해 오더북에 올립니다.
 * 판매자는 이후 이 입찰을 fulfill 할 수 있습니다.
 */
export function SignPoolBidSeaport({
  tokenId,
  poolBidId,
  onDone,
}: SignPoolBidSeaportProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: prep, isLoading, isError, error } = useQuery({
    queryKey: ["prepare-pool-bid", poolBidId, tokenId],
    queryFn: () => preparePoolBidFulfillment(poolBidId, tokenId),
    staleTime: 0,
    retry: false,
  });

  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled:
        !!address &&
        !!prep?.match &&
        prep.bucketBid.buyerOfferer.toLowerCase() === address.toLowerCase(),
    },
  });

  const buyerOk =
    address &&
    prep?.match &&
    prep.bucketBid.buyerOfferer.toLowerCase() === address.toLowerCase();

  async function handleSign() {
    if (!prep?.match || !address || !walletClient || !publicClient || !buyerOk) return;
    if (counter === undefined) {
      setErrorMsg("Could not read Seaport counter.");
      return;
    }

    const d = prep.parametersDraft as Record<string, unknown>;
    const offer = d.offer as {
      itemType: number;
      token: string;
      identifierOrCriteria: string;
      startAmount: string;
      endAmount: string;
    }[];
    const consideration = d.consideration as {
      itemType: number;
      token: string;
      identifierOrCriteria: string;
      startAmount: string;
      endAmount: string;
      recipient: string;
    }[];

    const priceInUnits = BigInt(offer[0].startAmount);
    const salt = BigInt(String(d.salt));
    const startTime = BigInt(String(d.startTime));
    const endTime = BigInt(String(d.endTime));

    setErrorMsg("");
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
            itemType: offer[0].itemType,
            token: offer[0].token as `0x${string}`,
            identifierOrCriteria: BigInt(offer[0].identifierOrCriteria),
            startAmount: BigInt(offer[0].startAmount),
            endAmount: BigInt(offer[0].endAmount),
          },
        ],
        consideration: [
          {
            itemType: consideration[0].itemType,
            token: consideration[0].token as `0x${string}`,
            identifierOrCriteria: BigInt(consideration[0].identifierOrCriteria),
            startAmount: BigInt(consideration[0].startAmount),
            endAmount: BigInt(consideration[0].endAmount),
            recipient: consideration[0].recipient as `0x${string}`,
          },
        ],
        orderType: Number(d.orderType ?? 0),
        startTime,
        endTime,
        zoneHash: ((d.zoneHash as string) ?? ZERO_BYTES32) as `0x${string}`,
        salt,
        conduitKey: ((d.conduitKey as string) ?? ZERO_BYTES32) as `0x${string}`,
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
        bucketBidId: poolBidId,
        parameters: {
          offerer: str(orderMessage.offerer),
          zone: str(ZERO_ADDRESS),
          zoneHash: str(orderMessage.zoneHash),
          startTime: str(startTime),
          endTime: str(endTime),
          orderType: Number(d.orderType ?? 0),
          offer: [
            {
              itemType: offer[0].itemType,
              token: offer[0].token,
              identifierOrCriteria: str(offer[0].identifierOrCriteria),
              startAmount: str(offer[0].startAmount),
              endAmount: str(offer[0].endAmount),
            },
          ],
          consideration: [
            {
              itemType: consideration[0].itemType,
              token: consideration[0].token,
              identifierOrCriteria: str(consideration[0].identifierOrCriteria),
              startAmount: str(consideration[0].startAmount),
              endAmount: str(consideration[0].endAmount),
              recipient: str(consideration[0].recipient),
            },
          ],
          totalOriginalConsiderationItems: Number(d.totalOriginalConsiderationItems ?? 1),
          salt: str(salt),
          conduitKey: str(orderMessage.conduitKey),
          counter: str(counter),
        },
        signature,
        tokenContract: TOKENABLE_RWA_ADDRESS,
        tokenId: String(tokenId),
        considerationToken: USDC_ADDRESS,
        considerationAmount: str(offer[0].startAmount),
      });

      setStep("success");
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-bids", tokenId] });
      await queryClient.invalidateQueries({ queryKey: ["nft-activity", tokenId] });
      await queryClient.invalidateQueries({
        queryKey: ["marketplace-order-by-token", tokenId],
      });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-pool-bids", tokenId] });
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed");
      setStep("error");
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-mint-deep/30 bg-mint/[0.06] px-3 py-3 text-[11px] text-gray-400">
        Preparing pool bid signing…
      </div>
    );
  }

  if (isError || !prep) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-[11px] text-red-300">
        {error instanceof Error ? error.message : "Could not load pool bid preparation."}
      </div>
    );
  }

  if (!prep.match) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-[11px] text-amber-200">
        {prep.buyerMessage}
      </div>
    );
  }

  if (!buyerOk) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/80 px-3 py-3 text-[11px] text-gray-400 leading-relaxed">
        <p className="font-semibold text-gray-200 mb-1">Pool bid authorization</p>
        Connect the buyer wallet{" "}
        <span className="font-mono text-gray-300">{prep.bucketBid.buyerOfferer}</span> to
        sign the Seaport bid for this token.
      </div>
    );
  }

  const busy = step === "approving" || step === "signing" || step === "submitting";

  if (step === "success") {
    return (
      <div className="rounded-xl border border-mint-deep/35 bg-mint/[0.08] px-3 py-3 space-y-2">
        <p className="text-xs font-semibold text-mint">Seaport bid submitted</p>
        <p className="text-[11px] text-gray-400">
          The seller can now fulfill this bid on-chain for token #{tokenId}.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-mint/20 text-mint border border-mint-deep/35"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-mint-deep/35 bg-mint/[0.06] px-3 py-3 space-y-2">
      <p className="text-xs font-bold text-mint">Authorize pool bid (Seaport)</p>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        Sign a token-specific buy order so the owner of #{tokenId} can sell into your pool
        bid (
        <span className="tabular-nums text-gray-300">
          {formatUnits(BigInt(prep.bucketBid.considerationAmount), 6)} USDC
        </span>
        ).
      </p>
      {errorMsg && (
        <p className="text-[10px] text-red-400 break-all">{errorMsg}</p>
      )}
      <button
        type="button"
        disabled={busy || counter === undefined}
        onClick={() => void handleSign()}
        className="w-full text-xs py-2 rounded-lg bg-mint/20 text-mint font-semibold border border-mint-deep/35 disabled:opacity-50"
      >
        {busy ? "Working…" : "Approve USDC & sign bid"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="w-full text-[10px] py-1 text-gray-500 hover:text-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}
