"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useTokenOffer } from "@/hooks/token-offer/useTokenOffer";
import { bestBidFromRows } from "@/lib/marketplace/unified-order-book";
import { askPriceMicros } from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import {
  TOKEN_BID_UI_DURATION_DAYS,
  tokenBidDurationOptionLabel,
} from "@/lib/seaport/orders/submitTokenBid";
import { feePercent } from "@/lib/seaport/orders/platformFee";

function formatUsdc2(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Card.html ask/highest cards — whole dollars, e.g. `$9,000`. */
function formatUsdWhole(n: number): string {
  return n.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

function shortWallet(addr: string): string {
  const s = addr.trim();
  if (s.length < 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function formatBidInputDisplay(raw: string): string {
  if (!raw) return "";
  const trailingDot = raw.endsWith(".");
  const [intRaw, fracRaw] = raw.split(".");
  const intDigits = (intRaw ?? "").replace(/[^0-9]/g, "");
  if (!intDigits && !trailingDot && !(fracRaw && fracRaw.length > 0)) return "";
  const intNum = intDigits === "" ? 0 : parseInt(intDigits, 10);
  const intFmt = Number.isFinite(intNum)
    ? intNum.toLocaleString("en-US")
    : intDigits;
  if (trailingDot && (!fracRaw || fracRaw.length === 0)) return `${intFmt}.`;
  if (raw.includes(".")) return `${intFmt}.${(fracRaw ?? "").slice(0, 1)}`;
  return intFmt;
}

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

  const listedHint = useMemo(() => {
    const parts: string[] = [];
    if (askDisplayUsd != null) {
      parts.push(`Listed at $${formatUsdc2(askDisplayUsd)}`);
    }
    if (highestDisplayUsd != null) {
      parts.push(`Highest offer $${formatUsdc2(highestDisplayUsd)}`);
    }
    if (parts.length === 0) {
      return "No active listing · connect wallet to bid";
    }
    if (!bid.isConnected) {
      return `${parts[0]} · connect wallet to bid`;
    }
    return parts.join(" · ");
  }, [
    askDisplayUsd,
    highestDisplayUsd,
    bid.isConnected,
  ]);

  const hintText =
    bid.policyHint.tone === "error"
      ? bid.policyHint.text
      : !bid.isConnected
        ? listedHint
        : bid.policyHint.text;
  const hintTone = bid.policyHint.tone === "error" ? "error" : "muted";

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
      ? "Owned instantly. Your card stays safe in the vault — withdraw it anytime."
      : placedBidLabel
        ? `Your bid of $${placedBidLabel} is live for ${expiryLabel}. We'll notify you if it's matched — no funds are held until then.`
        : `Your bid is live for ${expiryLabel}. We'll notify you if it's matched — no funds are held until then.`;

    return (
      <div className="cd-listing-checkout__done">
        <div className="cd-listing-checkout__done-icon" aria-hidden>
          <span>&#10003;</span>
        </div>
        <div className="cd-listing-checkout__done-title">{doneTitle}</div>
        <p className="cd-listing-checkout__done-msg">{doneMsg}</p>
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
    <>
      <label className="cd-listing-checkout__label" htmlFor="cd-listing-bid-amt">
        Your bid
      </label>

      <div className="cd-listing-checkout__bid-stats" aria-label="Market context">
        <div className="cd-listing-checkout__bid-stat">
          <div className="cd-listing-checkout__bid-stat-label tkl-mono">Ask price</div>
          <div className="cd-listing-checkout__bid-stat-value">
            {askDisplayUsd != null ? `$${formatUsdWhole(askDisplayUsd)}` : "—"}
          </div>
        </div>
        <div className="cd-listing-checkout__bid-stat">
          <div className="cd-listing-checkout__bid-stat-label tkl-mono">Highest bid</div>
          <div className="cd-listing-checkout__bid-stat-value cd-listing-checkout__bid-stat-value--pos">
            {highestDisplayUsd != null ? `$${formatUsdWhole(highestDisplayUsd)}` : "—"}
          </div>
        </div>
      </div>

      <div className="cd-listing-checkout__bid-input-wrap">
        <span className="cd-listing-checkout__bid-prefix" aria-hidden>
          $
        </span>
        <input
          ref={inputRef}
          id="cd-listing-bid-amt"
          className="cd-listing-checkout__bid-input"
          type="text"
          inputMode="decimal"
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
      >
        {hintText}
      </div>

      <div className="cd-listing-checkout__label">Valid for</div>
      <div
        className="cd-listing-checkout__expiry"
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
          (Boolean(bid.address) && bid.ctaMode === "blocked")
        }
        onClick={handleAction}
      >
        {bid.ctaLabel}
      </TkButton>

      <p className="cd-listing-checkout__fine tkl-mono">
        No bid fee · {feePercent()}% charged on sale only
      </p>
    </>
  );
}
