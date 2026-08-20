"use client";

import { useEffect, useMemo } from "react";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useTokenOffer } from "@/hooks/token-offer/useTokenOffer";
import { ActionCompletePanel } from "@/components/marketplace/trade/ActionCompleteModal";
import { bestBidFromRows } from "@/lib/marketplace/unified-order-book";
import {
  TOKEN_BID_DURATION_DAYS,
  tokenBidDurationOptionLabel,
} from "@/lib/seaport/orders/submitTokenBid";
import { feePercent } from "@/lib/seaport/orders/platformFee";

function formatUsdc2(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortWallet(addr: string): string {
  const s = addr.trim();
  if (s.length < 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatBidInputDisplay(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : digits;
}

export function CollectionListingBidCheckout({
  collectionKey,
  tokenId,
  listing,
  collectionBids,
  listedPriceLabel,
  connectedAddress,
  bidToReplace,
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
  connectedAddress?: string;
  bidToReplace?: Order | null;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
  onHeaderTitleChange?: (title: string) => void;
  onDone?: () => void;
}) {
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
    onPlaced: () => onPlaced?.(),
    onPurchaseFilled: () => onPurchaseFilled?.(),
  });

  const highestBid = useMemo(() => bestBidFromRows(collectionBids), [collectionBids]);

  const listedHint = useMemo(() => {
    const parts: string[] = [];
    if (listedPriceLabel) {
      parts.push(`Listed at $${listedPriceLabel}`);
    }
    if (highestBid != null && highestBid > 0) {
      parts.push(`Highest offer $${formatUsdc2(highestBid)}`);
    }
    if (parts.length === 0) {
      if (bid.unlistedMarketFloorUsdc > 0) {
        return `Min bid $${formatUsdc2(bid.unlistedMarketFloorUsdc)} (70% of market) · No bid fee, 5% on sale only`;
      }
      return "No active listing · connect wallet to bid";
    }
    return parts.join(" · ");
  }, [listedPriceLabel, highestBid, bid.unlistedMarketFloorUsdc]);

  const hintText =
    bid.policyHint.tone === "error" || bid.policyHint.tone === "warn"
      ? bid.policyHint.text
      : bid.policyHint.tone === "muted" && !bid.price
        ? listedHint
        : bid.policyHint.text;
  const hintTone = bid.policyHint.tone;

  const showSuccess = bid.step === "success";
  const placedBidLabel = useMemo(() => {
    if (!Number.isFinite(bid.priceUsdc) || bid.priceUsdc <= 0) return null;
    return formatUsdc2(bid.priceUsdc);
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

  const handleAction = () => {
    runTradeAccessGate(() => {
      void bid.handleSubmit();
    });
  };

  if (showSuccess) {
    const instant = bid.lastOutcome === "instant";
    return (
      <ActionCompletePanel
        kind={instant ? "purchase" : "bid"}
        priceUsdc={bid.priceUsdc > 0 ? bid.priceUsdc : null}
        embedded
        showStatus={instant}
        sub={
          instant
            ? "You now own this asset."
            : placedBidLabel
              ? `Your bid of $${placedBidLabel} is live for ${expiryLabel}. We'll notify you if it's matched — no funds are held until then.`
              : `Your bid is live for ${expiryLabel}. We'll notify you if it's matched — no funds are held until then.`
        }
        secondaryLabel={instant ? "View in Portfolio" : undefined}
        secondaryHref={instant ? "/portfolio?tab=assets" : undefined}
        onSecondary={instant ? onDone : undefined}
        primaryLabel="Done"
        onPrimary={onDone}
      />
    );
  }

  return (
    <>
      <label className="cd-listing-checkout__label" htmlFor="cd-listing-bid-amt">
        Your bid
      </label>
      <div className="cd-listing-checkout__bid-input-wrap">
        <span className="cd-listing-checkout__bid-prefix" aria-hidden>
          $
        </span>
        <input
          id="cd-listing-bid-amt"
          className="cd-listing-checkout__bid-input"
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={formatBidInputDisplay(bid.price)}
          disabled={bid.busy}
          onChange={(e) =>
            bid.setPriceDigits(e.target.value.replace(/[^0-9]/g, ""))
          }
        />
      </div>
      <div
        className={
          hintTone === "error"
            ? "cd-listing-checkout__bid-hint cd-listing-checkout__bid-hint--error"
            : hintTone === "warn"
              ? "cd-listing-checkout__bid-hint cd-listing-checkout__bid-hint--warn"
              : "cd-listing-checkout__bid-hint"
        }
      >
        {hintText}
      </div>

      <div className="cd-listing-checkout__label">Valid for</div>
      <div
        className="cd-listing-checkout__expiry"
        role="radiogroup"
        aria-label="Valid for"
      >
        {TOKEN_BID_DURATION_DAYS.map((days) => {
          const on = bid.durationDays === days;
          return (
            <button
              key={days}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={bid.busy}
              className={
                on
                  ? "cd-listing-checkout__expiry-opt cd-listing-checkout__expiry-opt--on"
                  : "cd-listing-checkout__expiry-opt"
              }
              onClick={() => bid.setDurationDays(days)}
            >
              {tokenBidDurationOptionLabel(days)}
            </button>
          );
        })}
      </div>

      {!bid.isConnected ? (
        <div className="cd-listing-checkout__wallet cd-listing-checkout__wallet--disconnected">
          <span className="cd-listing-checkout__wallet-dot" aria-hidden />
          <span>No wallet connected — connect to continue</span>
        </div>
      ) : bid.address ? (
        <div className="cd-listing-checkout__wallet cd-listing-checkout__wallet--connected">
          <span className="cd-listing-checkout__wallet-id">
            <span className="cd-listing-checkout__wallet-icon" aria-hidden />
            <span className="tkl-mono">{shortWallet(bid.address)}</span>
          </span>
          {bid.balanceUsdc != null ? (
            <span className="cd-listing-checkout__wallet-balance tkl-mono">
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
        disabled={
          bid.busy ||
          (Boolean(bid.address) && bid.ctaMode === "blocked") ||
          (Boolean(bid.address) && bid.belowHardMarketFloor)
        }
        onClick={handleAction}
      >
        {bid.ctaLabel}
      </TkButton>

      {bid.ctaMode === "override" ? (
        <TkButton
          type="button"
          variant="subtle"
          size="sm"
          className="cd-listing-checkout__cta-aux"
          disabled={bid.busy}
          onClick={bid.handleAdjustBid}
        >
          Adjust bid
        </TkButton>
      ) : null}

      <p className="cd-listing-checkout__fine tkl-mono">
        No bid fee · {feePercent()}% charged on sale only
      </p>
    </>
  );
}
