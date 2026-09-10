"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useTokenOffer } from "@/hooks/token-offer/useTokenOffer";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { bestBidFromRows } from "@/lib/marketplace/unified-order-book";
import { shortenWalletAddress } from "@/lib/wallet/walletMenuDisplay";
import { askPriceMicros } from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import {
  TOKEN_BID_UI_DURATION_DAYS,
  tokenBidDurationOptionLabel,
} from "@/lib/seaport/orders/submitTokenBid";

function formatBidInputDisplay(raw: string): string {
  if (!raw) return "";
  const intDigits = raw.replace(/[^0-9]/g, "");
  if (!intDigits) return "";
  const intNum = parseInt(intDigits, 10);
  return Number.isFinite(intNum) ? intNum.toLocaleString("en-US") : intDigits;
}

/** Card.html `tkbF` — `$9,000.00`. */
function formatCheckoutUsd(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Card.html `#tkb-bid` — Place a bid body inside `#tk-buy`.
 */
export function CollectionListingBidCheckout({
  collectionKey,
  tokenId,
  listing,
  collectionBids,
  listedPriceLabel,
  askUsd,
  highestBidUsd,
  connectedAddress,
  bidToReplace,
  initialPriceUsdc,
  onPlaced,
  onPurchaseFilled,
  onHeaderTitleChange,
  onDone,
}: {
  collectionKey: string;
  tokenId: string | number;
  listing: Order;
  collectionBids: Order[];
  listedPriceLabel: string | null;
  /** Collection lowest ask — Card.html Ask price card (overrides listing when set). */
  askUsd?: number | null;
  /** Collection highest bid — Card.html Highest bid card. */
  highestBidUsd?: number | null;
  connectedAddress?: string;
  bidToReplace?: Order | null;
  /** Prefill Your bid from `#tk-trade` ±1% control. */
  initialPriceUsdc?: number | null;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
  onHeaderTitleChange?: (title: string) => void;
  onDone?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runTradeAccessGate } = useTradeAccessGate(
    `/marketplace/collections/${encodeURIComponent(collectionKey)}`,
  );

  const bid = useTokenOffer({
    collectionKey,
    tokenId,
    listing,
    collectionBids,
    connectedAddress,
    bidToReplace,
    initialPriceUsdc,
    onPlaced: () => onPlaced?.(),
    onPurchaseFilled: () => onPurchaseFilled?.(),
  });

  const bookHighestBid = useMemo(
    () => bestBidFromRows(collectionBids),
    [collectionBids],
  );

  const askDisplayUsd = useMemo(() => {
    if (askUsd != null && Number.isFinite(askUsd) && askUsd > 0) return askUsd;
    const micros = askPriceMicros(listing);
    if (micros > BigInt(0)) return Number(micros) / 1_000_000;
    if (listedPriceLabel) {
      const n = Number(listedPriceLabel.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }, [askUsd, listing, listedPriceLabel]);

  const highestDisplayUsd = useMemo(() => {
    if (highestBidUsd != null && Number.isFinite(highestBidUsd) && highestBidUsd > 0) {
      return highestBidUsd;
    }
    if (bookHighestBid != null && bookHighestBid > 0) return bookHighestBid;
    return null;
  }, [highestBidUsd, bookHighestBid]);

  /** Card.html `#tkb-bidhint` — listed / highest, or connect prompt. */
  const marketHint = useMemo(() => {
    if (!bid.isConnected) {
      if (askDisplayUsd != null) {
        return `Listed at $${formatCheckoutUsd(askDisplayUsd)} · connect wallet to bid`;
      }
      return "Connect wallet to bid";
    }
    const parts: string[] = [];
    if (askDisplayUsd != null) {
      parts.push(`Listed at $${formatCheckoutUsd(askDisplayUsd)}`);
    }
    if (highestDisplayUsd != null) {
      parts.push(`Highest offer $${formatCheckoutUsd(highestDisplayUsd)}`);
    }
    if (parts.length === 0) return "Enter a bid amount to continue.";
    return parts.join(" · ");
  }, [bid.isConnected, askDisplayUsd, highestDisplayUsd]);

  const hintText =
    bid.policyHint.tone === "error" ? bid.policyHint.text : marketHint;
  const hintTone = bid.policyHint.tone === "error" ? "error" : "muted";

  const showSuccess = bid.step === "success";
  const placedBidLabel = useMemo(() => {
    if (!Number.isFinite(bid.priceUsdc) || bid.priceUsdc <= 0) return null;
    return formatCheckoutUsd(bid.priceUsdc);
  }, [bid.priceUsdc]);
  const expiryLabel = tokenBidDurationOptionLabel(bid.durationDays);

  useEffect(() => {
    onHeaderTitleChange?.(
      showSuccess
        ? bid.lastOutcome === "instant"
          ? "Receipt"
          : "Bid placed"
        : "Place a bid",
    );
  }, [showSuccess, bid.lastOutcome, onHeaderTitleChange]);

  useEffect(() => {
    if (showSuccess) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [showSuccess]);

  const handleAction = () => {
    runTradeAccessGate(() => {
      void bid.handleSubmit();
    });
  };

  if (showSuccess) {
    const instant = bid.lastOutcome === "instant";
    const doneTitle = instant ? "Purchase complete" : "Bid submitted";
    const doneMsg = instant
      ? null
      : placedBidLabel
        ? `Your bid of $${placedBidLabel} is live for ${expiryLabel}.`
        : `Your bid is live for ${expiryLabel}.`;

    return (
      <div className="cd-listing-checkout__done" id="tkb-done">
        <div className="cd-listing-checkout__done-icon" aria-hidden>
          <span>&#10003;</span>
        </div>
        <div className="cd-listing-checkout__done-title" id="tkb-donetitle">
          {doneTitle}
        </div>
        {doneMsg ? (
          <p className="cd-listing-checkout__done-msg" id="tkb-donemsg">
            {doneMsg}
          </p>
        ) : null}
        {instant ? (
          <div className="cd-listing-checkout__done-status">
            <span className="cd-listing-checkout__done-status-label tkl-mono">
              Status
            </span>
            <span className="cd-listing-checkout__done-status-value tkl-mono">
              Owned · in vault
            </span>
          </div>
        ) : null}
        <div
          className={
            instant
              ? "cd-listing-checkout__done-actions"
              : "cd-listing-checkout__done-actions cd-listing-checkout__done-actions--solo"
          }
        >
          {instant ? (
            <TkButton
              variant="primary"
              size="sm"
              className="cd-listing-checkout__done-primary"
              id="tkb-cta"
              href="/portfolio?tab=assets"
              onClick={onDone}
            >
              View in Portfolio
            </TkButton>
          ) : null}
          <TkButton
            type="button"
            variant="subtle"
            size="sm"
            className="cd-listing-checkout__done-secondary"
            onClick={onDone}
          >
            Done
          </TkButton>
        </div>
      </div>
    );
  }

  return (
    <div id="tkb-form">
      <div id="tkb-bid">
        <label className="cd-listing-checkout__label" htmlFor="tkb-bidamt">
          Your bid
        </label>

        <div className="cd-listing-checkout__bid-stats" aria-label="Market context">
          <div className="cd-listing-checkout__bid-stat">
            <div className="cd-listing-checkout__bid-stat-label tkl-mono">
              Ask price
            </div>
            <div className="cd-listing-checkout__bid-stat-value">
              {askDisplayUsd != null ? formatUsdListing(askDisplayUsd) : "—"}
            </div>
          </div>
          <div className="cd-listing-checkout__bid-stat">
            <div className="cd-listing-checkout__bid-stat-label tkl-mono">
              Highest bid
            </div>
            <div className="cd-listing-checkout__bid-stat-value cd-listing-checkout__bid-stat-value--pos">
              {highestDisplayUsd != null
                ? formatUsdListing(highestDisplayUsd)
                : "—"}
            </div>
          </div>
        </div>

        <div className="cd-listing-checkout__bid-input-wrap">
          <span className="cd-listing-checkout__bid-prefix" aria-hidden>
            $
          </span>
          <input
            ref={inputRef}
            id="tkb-bidamt"
            className="cd-listing-checkout__bid-input"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={formatBidInputDisplay(bid.price)}
            disabled={bid.busy}
            onChange={(e) => bid.setPriceDigits(e.target.value)}
          />
        </div>

        <div
          className={
            hintTone === "error"
              ? "cd-listing-checkout__bid-hint cd-listing-checkout__bid-hint--error"
              : "cd-listing-checkout__bid-hint"
          }
          id="tkb-bidhint"
        >
          {hintText}
        </div>

        <div className="cd-listing-checkout__label">Valid for</div>
        <div
          className="cd-listing-checkout__expiry"
          id="tkb-expiry"
          role="radiogroup"
          aria-label="Valid for"
        >
          {TOKEN_BID_UI_DURATION_DAYS.map((days) => {
            const on = bid.durationDays === days;
            return (
              <button
                key={days}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={bid.busy}
                data-exp={tokenBidDurationOptionLabel(days)}
                className={
                  on
                    ? "cd-listing-checkout__expiry-opt cd-listing-checkout__expiry-opt--on tkb-exp on"
                    : "cd-listing-checkout__expiry-opt tkb-exp"
                }
                onClick={() => bid.setDurationDays(days)}
              >
                {tokenBidDurationOptionLabel(days)}
              </button>
            );
          })}
        </div>
      </div>

      {!bid.isConnected ? (
        <div
          className="cd-listing-checkout__wallet cd-listing-checkout__wallet--disconnected"
          id="tkb-disc"
        >
          <span className="cd-listing-checkout__wallet-dot" aria-hidden />
          <span>No wallet connected.</span>
        </div>
      ) : bid.address ? (
        <div
          className="cd-listing-checkout__wallet cd-listing-checkout__wallet--connected"
          id="tkb-conn"
        >
          <span className="cd-listing-checkout__wallet-id">
            <span className="cd-listing-checkout__wallet-icon" aria-hidden />
            <span className="tkl-mono">{shortenWalletAddress(bid.address)}</span>
          </span>
          {bid.balanceUsdc != null ? (
            <span
              className="cd-listing-checkout__wallet-balance tkl-mono"
              id="tkb-bal"
            >
              {bid.balanceUsdc.toLocaleString("en-US")} USDC
            </span>
          ) : null}
        </div>
      ) : null}

      <TkButton
        type="button"
        variant="primary"
        size="sm"
        className="cd-listing-checkout__cta"
        id="tkb-action"
        disabled={
          bid.busy ||
          (Boolean(bid.address) &&
            (bid.ctaMode === "blocked" || !bid.priceOk))
        }
        onClick={handleAction}
      >
        {bid.ctaLabel}
      </TkButton>

      <p className="cd-listing-checkout__fine tkl-mono" id="tkb-foot">
        No bid fee.
      </p>
    </div>
  );
}
