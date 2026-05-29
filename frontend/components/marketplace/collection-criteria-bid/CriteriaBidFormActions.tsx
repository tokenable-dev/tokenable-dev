"use client";

import Link from "next/link";
import { COLLECTION_DETAILS_BORDER_T } from "@/components/marketplace/collectionOverviewChrome";
import type { Order } from "@/lib/core";
import type { CollectionCriteriaBidStep } from "./types";

export function CriteriaBidFormActions({
  embedded,
  address,
  walletSignerMissing,
  submitDisabled,
  busy,
  busyLabel,
  crossesBook,
  lowestAsk,
  lowestAskUsdc,
  errorMsg,
  step,
  lastOutcome,
  postBidMatchHint,
  onSubmit,
  onOpenSellModal,
}: {
  embedded: boolean;
  address: string | undefined;
  walletSignerMissing: boolean;
  submitDisabled: boolean;
  busy: boolean;
  busyLabel: string;
  crossesBook: boolean;
  lowestAsk: Order | null;
  lowestAskUsdc: string | null;
  errorMsg: string;
  step: CollectionCriteriaBidStep;
  lastOutcome: "instant" | "bid" | null;
  postBidMatchHint: string | null;
  onSubmit: () => void;
  onOpenSellModal?: () => void;
}) {
  return (
    <>
      <button
        type="button"
        disabled={submitDisabled}
        onClick={onSubmit}
        title={
          crossesBook && lowestAsk
            ? `Instant buy: pay ${lowestAskUsdc} USDC for token #${lowestAsk.tokenId} (listing price).`
            : !crossesBook
              ? "Sign a collection bid up to your entered USDC amount."
              : undefined
        }
        className={`w-full min-h-[40px] font-bold text-white shadow-md shadow-black/20 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 ${
          embedded
            ? "rounded-md bg-[#16A34A] px-3 py-2 text-xs"
            : "rounded-xl bg-mint-deep py-3 text-sm hover:brightness-110"
        }`}
      >
        {!address
          ? embedded
            ? "Connect"
            : "Connect wallet"
          : walletSignerMissing
            ? embedded
              ? "Open wallet"
              : "Open wallet…"
            : busy
              ? busyLabel
              : crossesBook && lowestAsk
                ? "Buy now"
                : embedded
                  ? "Place bid"
                  : "Buy"}
      </button>

      {errorMsg ? (
        <p className={`text-rose-400/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}>
          {errorMsg}
        </p>
      ) : null}

      {step === "success" ? (
        <>
          <p
            className={`text-mint/90 ${embedded ? "text-[10px]" : "text-[11px]"}`}
            title={
              lastOutcome === "instant"
                ? "Purchase complete — check your wallet for the RWA."
                : "Collection bid is on the book; sellers can fulfill against it."
            }
          >
            {embedded
              ? lastOutcome === "instant"
                ? "Bought."
                : "Bid placed."
              : lastOutcome === "instant"
                ? "Purchase complete. The RWA is in your wallet."
                : "Collection bid saved. Sellers can match from their listing."}
          </p>
          {lastOutcome === "bid" && postBidMatchHint ? (
            <p
              className={`text-amber-200/85 ${embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
            >
              {postBidMatchHint}
            </p>
          ) : null}
        </>
      ) : null}

      {!embedded ? (
        <div className={`pt-2 ${COLLECTION_DETAILS_BORDER_T}`}>
          <p className="mb-2 text-[11px] text-gray-500">
            Selling is per token: list a specific RWA from your wallet.
          </p>
          {onOpenSellModal ? (
            <button
              type="button"
              onClick={onOpenSellModal}
              title="Open listing flow for this collection"
              className="w-full min-h-[40px] rounded-md border border-mint/25 bg-mint/[0.06] py-2 text-center text-xs font-bold text-mint hover:bg-mint/[0.1]"
            >
              List for sale
            </button>
          ) : (
            <Link
              href="/portfolio"
              title="Manage assets and create listings"
              className="block w-full min-h-[40px] rounded-md border border-mint/25 bg-mint/[0.06] py-2 text-center text-xs font-bold text-mint hover:bg-mint/[0.1]"
            >
              Portfolio
            </Link>
          )}
        </div>
      ) : null}
    </>
  );
}
