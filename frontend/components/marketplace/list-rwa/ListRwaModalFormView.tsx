"use client";

import { formatUnits } from "viem";
import type { Order } from "@/lib/core";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import {
  feePercent,
  type AskSettlementPolicy,
} from "@/lib/seaport/orders/platformFee";
import { TkButton } from "@/components/ds";
import { ListingFlowProgress } from "./ListingFlowProgress";
import { listModalAssetLabel, shortBidder } from "@/lib/seaport/listing/listRwaModalUtils";
import type { ListRwaModalStep } from "@/lib/seaport/listing/listRwaModalTypes";
import { ListRwaPriceInput } from "./ListRwaPriceInput";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";

export function ListRwaModalFormView({
  tokenId,
  assetTitle,
  collectionKey,
  isReplaceListing,
  price,
  onPriceChange,
  crossingBidsForInstantSale,
  selectedBidHash,
  onSelectBidHash,
  topCollectionBid: _topCollectionBid,
  marketValueUsd,
  listedPriceUsd,
  onRequestCancelListing,
  onClose,
  copyVariant = "default",
  settlementPolicy = "standard",
  vaultLabel,
  step,
  errorMsg,
  isProcessing,
  onSubmit,
  variant = "modal",
}: {
  tokenId: number;
  assetTitle?: string | null;
  collectionKey?: string | null;
  isReplaceListing: boolean;
  price: string;
  onPriceChange: (value: string) => void;
  crossingBidsForInstantSale: Order[];
  selectedBidHash: string | null;
  onSelectBidHash: (hash: string) => void;
  topCollectionBid?: { micros: bigint; label: string; inputValue: string } | null;
  marketValueUsd?: number | null;
  listedPriceUsd?: number | null;
  onRequestCancelListing?: () => void;
  onClose?: () => void;
  copyVariant?: "default" | "set-price";
  settlementPolicy?: AskSettlementPolicy;
  vaultLabel?: string;
  step: ListRwaModalStep;
  errorMsg: string;
  isProcessing: boolean;
  onSubmit: () => void;
  /** `embedded` — card detail inline panel; `sheet` — TkActionSheet on RWA detail. */
  variant?: "modal" | "embedded" | "sheet";
}) {
  const isEmbedded = variant === "embedded";
  const isSheet = variant === "sheet";
  const isSetPrice = copyVariant === "set-price";
  const showFlowProgress =
    !isEmbedded ||
    isProcessing ||
    step === "approving" ||
    step === "signing" ||
    step === "submitting" ||
    step === "matching";

  const eyebrow = isSetPrice
    ? isReplaceListing
      ? "Edit price"
      : "Set price"
    : isReplaceListing
      ? "Update listing"
      : "New listing";

  const ctaLabel = isProcessing
    ? "Processing..."
    : isSetPrice
      ? isReplaceListing
        ? "Update price →"
        : "List for sale →"
      : isReplaceListing
        ? "Update listing"
        : "List for sale";

  const listedAt =
    listedPriceUsd != null && Number.isFinite(listedPriceUsd)
      ? listedPriceUsd
      : null;
  const isSelfVaultHold = settlementPolicy === "self_vault_hold";
  const feePct = isSelfVaultHold ? 5 : feePercent(settlementPolicy);

  return (
    <div className={`flex min-w-0 flex-col ${isEmbedded ? "gap-4" : "gap-5 pt-1"}`}>
      {!isEmbedded ? (
        <header
          className={`flex gap-3 ${isSheet ? "pb-3" : "border-b border-white/[0.06] pb-4"}`}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <p
              className={
                isSheet
                  ? "rd-list-sheet__eyebrow"
                  : "text-[10px] font-semibold uppercase tracking-[0.14em] text-mint/90"
              }
            >
              {eyebrow}
            </p>
            <h2
              className="text-base font-semibold leading-snug tracking-tight text-white break-words [overflow-wrap:anywhere] sm:text-[1.125rem]"
              title={listModalAssetLabel(tokenId, assetTitle)}
            >
              {listModalAssetLabel(tokenId, assetTitle)}
            </h2>
            {vaultLabel ? (
              <p className="text-[11px] font-medium text-white/45">{vaultLabel}</p>
            ) : null}
          </div>
          {!isSheet ? <div className="w-7 shrink-0 sm:w-8" aria-hidden /> : null}
        </header>
      ) : null}

      {isReplaceListing ? (
        <div className="rd-list-sheet__listed">
          <div className="rd-list-sheet__ref-label">
            {listedAt != null ? "Currently listed at" : "Status"}
          </div>
          <span className="rd-list-sheet__ref-val">
            {listedAt != null ? formatPortfolioUsd(listedAt) : "Listed"}
          </span>
        </div>
      ) : null}

      <ListRwaPriceInput
        tokenId={tokenId}
        collectionKey={collectionKey}
        price={price}
        onPriceChange={onPriceChange}
        feePercent={feePct}
        marketValueUsd={marketValueUsd}
        disabled={isProcessing}
        payoutNote={
          isSelfVaultHold
            ? "Sale USDC goes to Tokenable first. After the buyer confirms, you receive the amount above (after the platform fee)."
            : null
        }
      />

      {isSetPrice ? (
        <p className="rd-list-sheet__hint">
          {isReplaceListing
            ? "The new price applies as soon as you update it."
            : "Your card goes live at the price you set."}
        </p>
      ) : null}

      {crossingBidsForInstantSale.length >= 2 && selectedBidHash ? (
        <div className="rounded-xl border border-mint/25 bg-mint/[0.07] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mint/95">
            Instant sell target
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            {crossingBidsForInstantSale.length} bids can fill now at this price. Pick which bid
            to sell into — only that offer is matched; other bids stay on the book.
          </p>
          <ul className="mt-2.5 max-h-[112px] space-y-1.5 overflow-y-auto pr-1">
            {crossingBidsForInstantSale.map((b) => {
              const id = String(b.orderHash);
              const selected = selectedBidHash === id;
              const usdc = Number(formatUnits(bidUsdcAmount(b), 6));
              return (
                <li key={id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? "border-mint/45 bg-mint/[0.1]"
                        : "border-zinc-600/50 bg-zinc-900/40 hover:border-zinc-500/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="instant-target-bid"
                      className="accent-mint"
                      checked={selected}
                      disabled={isProcessing}
                      onChange={() => onSelectBidHash(id)}
                    />
                    <span className="text-[12px] text-zinc-200">
                      <span className="mr-2 font-mono tabular-nums text-mint">
                        {usdc.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USDC
                      </span>
                      Buyer{" "}
                      <span className="font-mono text-mint/90">
                        {shortBidder(b.offerer)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {showFlowProgress ? <ListingFlowProgress step={step} /> : null}

      {step === "error" && errorMsg && (
        <div className="rounded-xl border border-red-500/35 bg-red-950/40 p-3">
          <p className={`text-red-300/95 break-all ${isEmbedded ? "text-sm" : "text-xs"}`}>
            {errorMsg}
          </p>
        </div>
      )}

      <TkButton
        className="mt-0.5 w-full justify-center"
        onClick={onSubmit}
        disabled={isProcessing || !price || parseFloat(price) <= 0}
      >
        {ctaLabel}
      </TkButton>

      {isSetPrice && isReplaceListing && onRequestCancelListing ? (
        <TkButton
          type="button"
          variant="ghost"
          className="w-full justify-center"
          disabled={isProcessing}
          onClick={onRequestCancelListing}
        >
          Cancel listing
        </TkButton>
      ) : isSetPrice && onClose ? (
        <TkButton
          type="button"
          variant="ghost"
          className="w-full justify-center"
          disabled={isProcessing}
          onClick={onClose}
        >
          Cancel
        </TkButton>
      ) : null}
    </div>
  );
}
