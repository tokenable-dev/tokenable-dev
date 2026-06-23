"use client";

import Link from "next/link";
import { COLLECTION_DETAILS_BORDER_T } from "@/components/marketplace/collectionOverviewChrome";
import type { Order } from "@/lib/core";
import type { CollectionCriteriaBidActionLayout, CollectionCriteriaBidStep } from "./types";

export function CriteriaBidFormActions({
  embedded,
  minimal = false,
  actionLayout = "combined",
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
  hideSellFooter = false,
  isReplaceBid = false,
  bidLimitMsg = "",
  usdcInsufficientMsg = "",
}: {
  embedded: boolean;
  minimal?: boolean;
  actionLayout?: CollectionCriteriaBidActionLayout;
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
  hideSellFooter?: boolean;
  isReplaceBid?: boolean;
  bidLimitMsg?: string;
  usdcInsufficientMsg?: string;
}) {
  const splitActions = actionLayout === "split";
  const submitLabel = !address
    ? embedded
      ? "Connect"
      : "Connect wallet"
    : walletSignerMissing
      ? embedded
        ? "Open wallet"
        : "Open wallet…"
      : busy
        ? busyLabel
        : isReplaceBid
          ? "Update bid"
          : splitActions
            ? "Place bid"
            : crossesBook && lowestAsk
              ? "Buy now"
              : embedded
                ? "Place bid"
                : "Buy";

  return (
    <>
      {bidLimitMsg && !crossesBook ? (
        <p
          className={`text-amber-200/90 ${minimal ? "text-sm" : embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
        >
          {bidLimitMsg}
        </p>
      ) : null}

      {usdcInsufficientMsg ? (
        <p
          className={`text-rose-400/90 ${minimal ? "text-sm" : embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
        >
          {usdcInsufficientMsg}
        </p>
      ) : null}

      <button
        type="button"
        disabled={submitDisabled}
        onClick={onSubmit}
        title={
          isReplaceBid
            ? "Sign an updated collection bid at your new USDC amount. The previous bid is cancelled in one step."
            : splitActions
            ? "Sign a collection bid up to your entered USDC amount."
            : crossesBook && lowestAsk
              ? `Instant buy: pay ${lowestAskUsdc} USDC for token #${lowestAsk.tokenId} (listing price).`
              : !crossesBook
                ? "Sign a collection bid up to your entered USDC amount."
                : undefined
        }
        className={`w-full font-bold text-white shadow-md shadow-black/20 transition hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 ${
          minimal
            ? "min-h-[52px] rounded-xl bg-[#16A34A] px-4 py-3 text-base"
            : embedded
              ? "min-h-[40px] rounded-md bg-[#16A34A] px-3 py-2 text-xs"
              : "min-h-[40px] rounded-xl bg-mint-deep py-3 text-sm hover:brightness-110"
        }`}
      >
        {submitLabel}
      </button>

      {errorMsg ? (
        <p
          className={`text-rose-400/90 ${minimal ? "text-sm" : embedded ? "text-[10px]" : "text-[11px]"}`}
        >
          {errorMsg}
        </p>
      ) : null}

      {step === "success" ? (
        <p
          className={`text-mint/90 ${minimal ? "text-sm font-medium" : embedded ? "text-[10px]" : "text-[11px]"}`}
        >
          {minimal
            ? lastOutcome === "instant"
              ? "Purchase complete."
              : isReplaceBid
                ? "Bid updated."
                : "Bid placed."
            : embedded
              ? lastOutcome === "instant"
                ? "Bought."
                : isReplaceBid
                  ? "Bid updated."
                  : "Bid placed."
              : lastOutcome === "instant"
                ? "Purchase complete. The RWA is in your wallet."
                : isReplaceBid
                  ? "Collection bid updated. Sellers can match at your new price."
                  : "Collection bid saved. Sellers can match from their listing."}
        </p>
      ) : null}

      {!minimal && step === "success" && lastOutcome === "bid" && postBidMatchHint ? (
        <p
          className={`text-amber-200/85 ${embedded ? "text-[10px] leading-snug" : "text-[11px] leading-snug"}`}
        >
          {postBidMatchHint}
        </p>
      ) : null}

      {!embedded && !hideSellFooter ? (
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
