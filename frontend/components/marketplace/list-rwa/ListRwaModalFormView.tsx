"use client";

import { formatUnits } from "viem";
import type { Order } from "@/lib/core";
import { bidUsdcAmount } from "@/lib/seaport/orders/bidUsdc";
import { feePercent } from "@/lib/seaport/orders/platformFee";
import { TkButton } from "@/components/ds";
import { ListingFlowProgress } from "./ListingFlowProgress";
import { listModalAssetLabel, shortBidder } from "@/lib/seaport/listing/listRwaModalUtils";
import type { ListRwaModalStep } from "@/lib/seaport/listing/listRwaModalTypes";
import { ListRwaPriceSuggestionsPanel } from "./ListRwaPriceSuggestionsPanel";
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
  topCollectionBid,
  marketValueUsd,
  listedPriceUsd,
  onRequestCancelListing,
  onClose,
  copyVariant = "default",
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

  const priceFieldLabel = isSetPrice
    ? "Your price"
    : isReplaceListing
      ? "Enter your new sale price in USDC below."
      : "Enter your sale price in USDC below.";

  const ctaLabel = isProcessing
    ? "Processing..."
    : isSetPrice
      ? isReplaceListing
        ? "Update price →"
        : "Set price →"
      : isReplaceListing
        ? "Update listing"
        : "List for sale";

  const listedAt =
    listedPriceUsd != null && Number.isFinite(listedPriceUsd)
      ? listedPriceUsd
      : null;
  const mkt =
    marketValueUsd != null && Number.isFinite(marketValueUsd) ? marketValueUsd : null;
  const feePct = feePercent();
  const priceNum = parseFloat(price);
  const showFee = price && Number.isFinite(priceNum) && priceNum > 0 && feePct > 0;

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
            {isSetPrice && mkt != null ? (
              <p className="rd-list-sheet__mkt">
                Current market value: {formatPortfolioUsd(mkt)}
              </p>
            ) : null}
          </div>
          {!isSheet ? <div className="w-7 shrink-0 sm:w-8" aria-hidden /> : null}
        </header>
      ) : null}

      {isSetPrice && topCollectionBid ? (
        <div className="rd-list-sheet__ref">
          <div>
            <div className="rd-list-sheet__ref-label">Highest bid</div>
            <span className="rd-list-sheet__ref-val">${topCollectionBid.label}</span>
          </div>
          <div className="rd-list-sheet__ref-actions">
            <span className="rd-list-sheet__ref-tag">TOP OFFER</span>
            <button
              type="button"
              className="rd-list-sheet__match"
              disabled={isProcessing}
              onClick={() => onPriceChange(topCollectionBid.inputValue)}
            >
              Match highest bid
            </button>
          </div>
        </div>
      ) : null}

      {isSetPrice && isReplaceListing && listedAt != null ? (
        <div className="rd-list-sheet__listed">
          <div className="rd-list-sheet__ref-label">Currently listed at</div>
          <span className="rd-list-sheet__ref-val">{formatPortfolioUsd(listedAt)}</span>
        </div>
      ) : null}

      <div className={isEmbedded ? "space-y-3" : "space-y-2.5"}>
        {!isEmbedded ? (
          <label
            htmlFor="list-rwa-price-usdc"
            className={
              isSetPrice
                ? "rd-list-sheet__ref-label block"
                : "block text-sm leading-relaxed text-zinc-300"
            }
          >
            {priceFieldLabel}
          </label>
        ) : (
          <label htmlFor="list-rwa-price-usdc" className="sr-only">
            {isReplaceListing ? "New listing price in USDC" : "Listing price in USDC"}
          </label>
        )}
        <div
          className={`relative rounded-xl border bg-mint/[0.04] shadow-[inset_0_0_0_1px_rgba(45,212,191,0.06)] transition-[border-color,box-shadow] focus-within:border-mint/65 focus-within:shadow-[0_0_0_2px_rgba(45,212,191,0.12)] ${
            isSheet
              ? "rd-list-sheet__price-wrap border-mint/40"
              : "border-mint/40"
          } ${isEmbedded ? "rounded-2xl" : ""}`}
        >
          {isSetPrice ? (
            <span className="rd-list-sheet__dollar" aria-hidden>
              $
            </span>
          ) : null}
          <input
            id="list-rwa-price-usdc"
            type="number"
            min="0.000001"
            step="any"
            placeholder="0.00"
            value={price}
            onChange={(e) => onPriceChange(e.target.value)}
            disabled={isProcessing}
            className={`w-full rounded-[10px] border-0 bg-transparent tabular-nums text-white outline-none placeholder:text-zinc-500 disabled:opacity-60 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              isEmbedded
                ? "px-4 py-3.5 pr-[4.5rem] text-2xl font-semibold sm:px-5 sm:py-4 sm:text-[1.75rem]"
                : isSetPrice
                  ? "px-4 py-2.5 pl-8 pr-16 text-[16px] font-mono font-semibold"
                  : "px-4 py-2.5 pr-16 text-[15px]"
            }`}
          />
          <span
            className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-medium uppercase tracking-wide ${
              isSheet ? "rd-list-sheet__usdc text-mint/70" : "text-mint/70"
            } ${isEmbedded ? "text-xs sm:text-sm" : "text-[11px]"}`}
          >
            USDC
          </span>
        </div>
        {!isSetPrice ? (
          <ListRwaPriceSuggestionsPanel
            tokenId={tokenId}
            collectionKey={collectionKey}
            onApplyPrice={onPriceChange}
            disabled={isProcessing}
          />
        ) : null}
        {showFee ? (
          <div
            className={
              isSetPrice
                ? "rd-list-sheet__fee"
                : `space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-3 py-2.5 ${
                    isEmbedded ? "text-sm" : "text-[11px]"
                  }`
            }
          >
            <div
              className={
                isSetPrice
                  ? "rd-list-sheet__fee-row"
                  : "flex justify-between gap-2 text-zinc-500"
              }
            >
              <span>Platform fee ({feePct}%)</span>
              <span className={isSetPrice ? "rd-list-sheet__fee-amt" : "font-mono text-zinc-400 tabular-nums"}>
                -{(priceNum * feePct / 100).toFixed(2)}
                {isSetPrice ? "" : " USDC"}
              </span>
            </div>
            <div
              className={
                isSetPrice
                  ? "rd-list-sheet__fee-row rd-list-sheet__fee-row--net"
                  : "flex justify-between gap-2 border-t border-zinc-700/40 pt-1.5 text-zinc-500"
              }
            >
              <span className={isSetPrice ? "rd-list-sheet__fee-net-label" : "text-zinc-400"}>
                You receive
              </span>
              <span
                className={
                  isSetPrice
                    ? "rd-list-sheet__fee-net"
                    : "font-mono font-medium tabular-nums text-white"
                }
              >
                {(priceNum * (1 - feePct / 100)).toFixed(2)}
                {isSetPrice ? "" : " USDC"}
              </span>
            </div>
          </div>
        ) : null}
        {isSetPrice && topCollectionBid ? (
          <p className="rd-list-sheet__hint">
            Highest bid shown for reference. Your card goes live at the price you set.
          </p>
        ) : null}
      </div>

      {crossingBidsForInstantSale.length >= 2 && selectedBidHash ? (
        <div className="rounded-xl border border-mint/25 bg-mint/[0.07] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-mint/95">
            Instant sell target
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
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
