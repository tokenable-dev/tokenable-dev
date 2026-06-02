"use client";

import type { MutableRefObject } from "react";
import {
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import type { Order } from "@/lib/core";

export function CriteriaBidFormPriceSection({
  embedded,
  minimal = false,
  balanceUsdc,
  lowestAsk,
  lowestAskUsdc,
  lowestAskCandidates,
  crossesBook,
  price,
  busy,
  address,
  priceTouchedRef,
  setPrice,
  priceOk,
  enteredAboveBestAsk,
  enteredUsdcLabel,
  merkleLoading,
  merkleLeafTokenIds,
  merkleIsError,
}: {
  embedded: boolean;
  minimal?: boolean;
  balanceUsdc: number | null;
  lowestAsk: Order | null;
  lowestAskUsdc: string | null;
  lowestAskCandidates: Order[];
  crossesBook: boolean;
  price: string;
  busy: boolean;
  address: string | undefined;
  priceTouchedRef: MutableRefObject<boolean>;
  setPrice: (v: string) => void;
  priceOk: boolean;
  enteredAboveBestAsk: boolean;
  enteredUsdcLabel: string | null;
  merkleLoading: boolean;
  merkleLeafTokenIds: string[];
  merkleIsError: boolean;
}) {
  const metaText = minimal
    ? "text-sm text-zinc-400"
    : embedded
      ? "text-[10px] text-gray-500"
      : "text-[11px] text-gray-500";
  const labelText = minimal
    ? "text-sm font-medium text-zinc-400"
    : embedded
      ? "text-[9px] font-medium uppercase tracking-wide text-gray-500"
      : "text-[10px] font-medium uppercase tracking-wide text-gray-500";
  const inputText = minimal
    ? "px-3 py-3 text-base"
    : embedded
      ? "px-2 py-1.5 text-xs"
      : "px-3 py-2.5 text-sm";
  const suffixText = minimal
    ? "px-3 py-3 text-sm text-zinc-400"
    : embedded
      ? "bg-zinc-900/60 px-2 py-1.5 text-[10px] text-zinc-500"
      : "bg-black/30 px-3 py-2.5 text-[11px] text-gray-500";

  return (
    <>
      <div className={`flex justify-between ${metaText}`}>
        <span>Balance</span>
        <span className="font-mono tabular-nums text-zinc-200">
          {balanceUsdc != null
            ? `${balanceUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "—"}
        </span>
      </div>

      {!minimal && lowestAsk ? (
        <p className="text-[10px] text-gray-600" title="Best ask (floor) in the order book.">
          <span className="text-zinc-500">Ask</span>{" "}
          <span className="font-mono tabular-nums text-gray-400">{lowestAskUsdc}</span>
          <span className="text-gray-600"> · #{lowestAsk.tokenId}</span>
        </p>
      ) : null}

      {!minimal && !lowestAsk ? (
        <p className="text-[10px] text-gray-600">
          {embedded
            ? "No asks in book."
            : "No active listings — you can still place a collection bid for this pool (covers all minted RWAs in the bucket)."}
        </p>
      ) : null}

      {!minimal && crossesBook && lowestAskCandidates.length >= 2 ? (
        <p className="text-[10px] text-zinc-500">
          {lowestAskCandidates.length} cards are listed at this floor price. Press{" "}
          <span className="text-zinc-300">Buy now</span> to choose one.
        </p>
      ) : null}

      <div>
        <label className={`mb-1 block ${labelText}`}>Price (USDC)</label>
        <div
          className={
            embedded || minimal
              ? `flex overflow-hidden rounded-lg ${COLLECTION_DETAILS_BORDER_ALL} bg-zinc-900/80 focus-within:border-zinc-500`
              : `flex overflow-hidden rounded-md ${COLLECTION_DETAILS_BORDER_ALL} bg-black/50 focus-within:border-gray-700`
          }
        >
          <input
            type="text"
            inputMode="decimal"
            placeholder={minimal ? "0.00" : "Amount in USDC"}
            value={price}
            disabled={busy || !address}
            onChange={(e) => {
              priceTouchedRef.current = true;
              setPrice(e.target.value);
            }}
            className={`min-w-0 flex-1 bg-transparent font-mono tabular-nums text-white placeholder:text-zinc-600 ${inputText}`}
          />
          <span
            className={`shrink-0 border-l border-[rgba(11,13,16,1)] font-mono font-semibold tabular-nums ${suffixText}`}
          >
            USDC
          </span>
        </div>
      </div>

      {!minimal && priceOk && crossesBook && lowestAsk && enteredAboveBestAsk && enteredUsdcLabel != null ? (
        <p
          className={`text-[10px] text-amber-200/80 ${embedded ? "leading-snug" : "rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 leading-relaxed"}`}
          title={`Instant buy charges the listing price (${lowestAskUsdc} USDC), not your typed amount.`}
        >
          {embedded
            ? `You pay ${lowestAskUsdc} USDC (list), not ${enteredUsdcLabel}.`
            : `You entered ${enteredUsdcLabel} USDC — you won&apos;t be charged that full amount; only ${lowestAskUsdc} USDC (listing price) is used for this purchase.`}
        </p>
      ) : null}

      {!minimal && !embedded && priceOk && crossesBook && lowestAsk ? (
        <p className="text-[10px] leading-relaxed text-mint/85">
          This price crosses the book — instant buy uses the{" "}
          <span className="font-semibold">cheapest listing</span>: token #{lowestAsk.tokenId} at{" "}
          {lowestAskUsdc} USDC (that&apos;s what you pay on-chain).
        </p>
      ) : null}

      {!minimal && !embedded && priceOk && !crossesBook ? (
        <p className="text-[10px] leading-relaxed text-gray-600">
          Below best ask — collection bid at your amount. Minted token(s) in this pool (Merkle):{" "}
          <span className="font-mono text-gray-400">
            {merkleLoading ? "…" : merkleLeafTokenIds.length}
          </span>
          .
        </p>
      ) : null}

      {!minimal && embedded && priceOk && !crossesBook ? (
        <p className="text-[10px] text-zinc-600" title="Merkle leaves = minted RWAs in this bucket.">
          Bid ·{" "}
          {merkleLoading
            ? "…"
            : `${merkleLeafTokenIds.length} token${merkleLeafTokenIds.length === 1 ? "" : "s"}`}{" "}
          in pool
        </p>
      ) : null}

      {merkleIsError ? (
        <p className={minimal ? "text-sm text-rose-400/90" : "text-[10px] text-rose-400/90"}>
          Could not load pool Merkle set. Check your connection and retry.
        </p>
      ) : null}
    </>
  );
}
