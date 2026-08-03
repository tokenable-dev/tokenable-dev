"use client";

import { useEffect, useMemo } from "react";
import type { Order } from "@/lib/core";
import { TkButton, TkField, TkInput } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useTokenOffer } from "@/hooks/token-offer/useTokenOffer";
import { bestBidFromRows } from "@/lib/marketplace/unified-order-book";
import { TOKEN_BID_ORDER_DURATION_SECONDS } from "@/lib/seaport/orders/submitTokenBid";

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

function tokenBidExpiryHint(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.max(1, Math.round(seconds / 60));
    return `Expires in ${mins} minute${mins === 1 ? "" : "s"}`;
  }
  if (seconds < 86400) {
    const hours = Math.max(1, Math.round(seconds / 3600));
    return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.max(1, Math.round(seconds / 86400));
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
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
        : "Place a Bid",
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
      <div className="cd-listing-checkout__done">
        <div className="cd-listing-checkout__done-icon" aria-hidden>
          <span>✓</span>
        </div>
        <div className="cd-listing-checkout__done-title">
          {instant ? "Purchase complete" : "Bid submitted"}
        </div>
        <p className="cd-listing-checkout__done-msg">
          {instant
            ? "Owned instantly. Your card stays safe in the vault — redeem it anytime."
            : placedBidLabel
              ? `Your bid of $${placedBidLabel} is live (${tokenBidExpiryHint(TOKEN_BID_ORDER_DURATION_SECONDS).toLowerCase()}). We'll notify you when a seller meets your price — no funds held until it matches.`
              : `Your bid is live (${tokenBidExpiryHint(TOKEN_BID_ORDER_DURATION_SECONDS).toLowerCase()}). We'll notify you when a seller meets your price — no funds held until it matches.`}
        </p>
        <div className="cd-listing-checkout__done-actions">
          <TkButton type="button" variant="ghost" className="cd-listing-checkout__done-secondary" onClick={onDone}>
            Done
          </TkButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <TkField
        className="cd-listing-checkout__bid"
        label="Your bid"
        htmlFor="cd-listing-bid-amt"
        error={
          bid.policyHint.tone === "error" ? bid.policyHint.text : undefined
        }
        hint={
          bid.policyHint.tone === "error"
            ? undefined
            : bid.policyHint.tone === "muted" && !bid.price
              ? listedHint
              : bid.policyHint.text
        }
      >
        <div className="cd-listing-checkout__bid-input-wrap">
          <span className="cd-listing-checkout__bid-prefix" aria-hidden>
            $
          </span>
          <TkInput
            id="cd-listing-bid-amt"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={formatBidInputDisplay(bid.price)}
            disabled={bid.busy}
            hasError={bid.policyHint.tone === "error"}
            onChange={(e) =>
              bid.setPriceDigits(e.target.value.replace(/[^0-9]/g, ""))
            }
            className="cd-listing-checkout__bid-input"
          />
        </div>
      </TkField>

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
        No bid fee · 5% charged on sale only · {tokenBidExpiryHint(TOKEN_BID_ORDER_DURATION_SECONDS)}
      </p>
    </>
  );
}
