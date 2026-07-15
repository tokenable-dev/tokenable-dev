"use client";

import { useEffect, useMemo } from "react";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useTokenOffer } from "@/hooks/token-offer/useTokenOffer";
import { bestBidFromRows } from "@/lib/marketplace/unified-order-book";

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
  listedPriceLabel: string;
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
    const parts = [`Listed at $${listedPriceLabel}`];
    if (highestBid != null && highestBid > 0) {
      parts.push(`Highest offer $${formatUsdc2(highestBid)}`);
    }
    return parts.join(" · ");
  }, [listedPriceLabel, highestBid]);

  const showSuccess = bid.step === "success";
  const placedBidLabel = useMemo(() => {
    if (!Number.isFinite(bid.priceUsdc) || bid.priceUsdc <= 0) return null;
    return formatUsdc2(bid.priceUsdc);
  }, [bid.priceUsdc]);

  useEffect(() => {
    onHeaderTitleChange?.(
      showSuccess
        ? bid.lastOutcome === "instant"
          ? "Purchase complete"
          : "Bid placed"
        : "Place a bid",
    );
  }, [showSuccess, bid.lastOutcome, onHeaderTitleChange]);

  const handleAction = () => {
    runTradeAccessGate(() => {
      void bid.handleSubmit();
    });
  };

  const hintToneClass =
    bid.policyHint.tone === "error"
      ? " cd-listing-checkout__bid-hint--error"
      : bid.policyHint.tone === "warn"
        ? " cd-listing-checkout__bid-hint--warn"
        : "";

  if (showSuccess) {
    const instant = bid.lastOutcome === "instant";
    return (
      <div className="cd-listing-checkout__done">
        <div className="cd-listing-checkout__done-icon" aria-hidden>
          <span>✓</span>
        </div>
        <div className="cd-listing-checkout__done-title">
          {instant ? "Purchase complete" : "Bid submitted"}
        </div>
        <p className="cd-listing-checkout__done-msg">
          {instant
            ? "You now own this asset. The token was transferred to your wallet; the slab stays vault-insured."
            : placedBidLabel
              ? `Your bid of $${placedBidLabel} is live. We'll notify you and settle on-chain the moment the seller accepts.`
              : "Your bid is live. We'll notify you and settle on-chain the moment the seller accepts."}
        </p>
        <div className="cd-listing-checkout__done-actions">
          <button type="button" className="cd-listing-checkout__done-secondary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cd-listing-checkout__bid">
        <label className="cd-listing-checkout__bid-label" htmlFor="cd-listing-bid-amt">
          Your bid
        </label>
        <div className="cd-listing-checkout__bid-input-wrap">
          <span className="cd-listing-checkout__bid-prefix" aria-hidden>
            $
          </span>
          <input
            id="cd-listing-bid-amt"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={formatBidInputDisplay(bid.price)}
            disabled={bid.busy}
            onChange={(e) =>
              bid.setPriceDigits(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="cd-listing-checkout__bid-input"
          />
        </div>
        <div
          className={`cd-listing-checkout__bid-hint tkl-mono${hintToneClass}`}
          role={
            bid.policyHint.tone === "error" || bid.policyHint.tone === "warn"
              ? "alert"
              : undefined
          }
        >
          {bid.policyHint.tone === "muted" && !bid.price ? listedHint : bid.policyHint.text}
        </div>
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
              {bid.balanceUsdc.toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              USDC
            </span>
          ) : null}
        </div>
      ) : null}

      <TkButton
        type="button"
        variant="primary"
        className="cd-listing-checkout__cta"
        disabled={
          bid.busy ||
          (Boolean(bid.address) && bid.submitDisabled && bid.ctaMode === "blocked")
        }
        onClick={handleAction}
      >
        {bid.ctaLabel}
      </TkButton>

      {bid.ctaMode === "override" ? (
        <TkButton
          type="button"
          variant="subtle"
          className="cd-listing-checkout__cta-aux"
          disabled={bid.busy}
          onClick={bid.handleAdjustBid}
        >
          Adjust bid
        </TkButton>
      ) : null}

      <p className="cd-listing-checkout__fine tkl-mono">
        No bid fee · 5% charged on sale only
      </p>
    </>
  );
}
