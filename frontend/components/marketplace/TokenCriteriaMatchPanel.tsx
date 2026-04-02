"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "@/config/wagmi";
import type { Order } from "@/lib/api";
import { bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";

type Step = "idle" | "matching" | "success" | "error";

function formatUsdc6(amount: bigint): string {
  return (Number(amount) / 1_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function TokenCriteriaMatchPanel({
  listing,
  collectionKey,
  tokenId,
  collectionBids,
}: {
  listing: Order;
  collectionKey: string;
  tokenId: number;
  collectionBids: Order[];
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeBidHash, setActiveBidHash] = useState<string | null>(null);

  const criteriaBids = useMemo(
    () =>
      collectionBids.filter(
        (b) =>
          b.status === "active" &&
          isCriteriaCollectionBid(b) &&
          bidUsdcAmount(b) >= BigInt(listing.considerationAmount)
      ),
    [collectionBids, listing.considerationAmount]
  );

  async function matchWithBid(bid: Order) {
    if (!address || !publicClient) {
      setErrorMsg("Connect a wallet.");
      return;
    }

    setErrorMsg("");
    setStep("matching");
    setActiveBidHash(bid.orderHash);

    try {
      const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
        writeContractAsync(
          args as Parameters<typeof writeContractAsync>[0]
        )) as MatchWriteContractAsync;

      await runCriteriaMatch({
        address,
        publicClient,
        writeContractAsync: matchWrite,
        bid,
        listing,
        tokenId,
        collectionKey,
      });

      setStep("success");
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-order-by-token", tokenId] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
      await queryClient.invalidateQueries({ queryKey: ["rwa-activity", tokenId] });
      await queryClient.invalidateQueries({ queryKey: ["merkle-set", collectionKey] });
    } catch (e: unknown) {
      setErrorMsg(mapMatchError(e));
      setStep("error");
    } finally {
      setActiveBidHash(null);
    }
  }

  if (!listing.collectionKey || listing.side === "bid") return null;

  if (criteriaBids.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/80 bg-black/20 px-3 py-3 text-[11px] text-gray-500">
        No collection bid at or above this ask. Buyers place criteria bids on the collection page.
      </div>
    );
  }

  return (
    <div
      id="criteria-match"
      className="rounded-xl border border-mint-deep/25 bg-[#0a0d11]/90 px-3 py-3 space-y-2"
    >
      <h3 className="text-xs font-semibold text-white">Match collection bid</h3>
      <p className="text-[10px] text-gray-500 leading-relaxed">
        Fills a buyer&apos;s criteria bid against this listing via{" "}
        <span className="text-gray-400">matchAdvancedOrders</span>. Anyone can submit; gas is paid
        by your wallet.
      </p>
      <ul className="space-y-2">
        {criteriaBids.map((b) => (
          <li
            key={b.orderHash}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800/90 bg-black/30 px-2 py-2"
          >
            <div className="text-[11px]">
              <span className="text-mint font-mono tabular-nums">{formatUsdc6(bidUsdcAmount(b))}</span>
              <span className="text-gray-500 ml-1">USDC</span>
              <span className="text-rose-300/90 ml-2">≥ ask</span>
            </div>
            <button
              type="button"
              disabled={!address || step === "matching"}
              onClick={() => void matchWithBid(b)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-mint/20 text-mint hover:bg-mint/30 disabled:opacity-40"
            >
              {activeBidHash === b.orderHash && step === "matching" ? "Matching…" : "Match"}
            </button>
          </li>
        ))}
      </ul>
      {step === "success" && (
        <p className="text-[11px] text-emerald-400/90">Match recorded. Balances may take a moment to refresh.</p>
      )}
      {step === "error" && errorMsg && (
        <p className="text-[11px] text-rose-400/90 break-words">{errorMsg}</p>
      )}
    </div>
  );
}
