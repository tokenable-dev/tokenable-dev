"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useCollectionCriteriaBid } from "@/hooks/collection-criteria-bid";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { CollectionCriteriaBidFloorChooserModal } from "@/components/marketplace/collection-criteria-bid/CollectionCriteriaBidFloorChooserModal";
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
  collectionAsks,
  collectionBids,
  listedPriceLabel,
  connectedAddress,
  onPlaced,
  onPurchaseFilled,
  onHeaderTitleChange,
  onDone,
}: {
  collectionKey: string;
  collectionAsks: Order[];
  collectionBids: Order[];
  listedPriceLabel: string;
  connectedAddress?: string;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
  onHeaderTitleChange?: (title: string) => void;
  onDone?: () => void;
}) {
  const { runTradeAccessGate } = useTradeAccessGate(
    `/marketplace/collections/${encodeURIComponent(collectionKey)}`,
  );
  const [hintError, setHintError] = useState<string | null>(null);

  const bid = useCollectionCriteriaBid({
    collectionKey,
    activeAsks: collectionAsks,
    connectedAddress,
    bidOnlySubmit: true,
    onPlaced: () => onPlaced?.(),
    onPurchaseFilled: () => onPurchaseFilled?.(),
  });

  const highestBid = useMemo(() => bestBidFromRows(collectionBids), [collectionBids]);

  const hintText = useMemo(() => {
    const parts = [`Listed at $${listedPriceLabel}`];
    if (highestBid != null && highestBid > 0) {
      parts.push(`Highest offer $${formatUsdc2(highestBid)}`);
    }
    return parts.join(" · ");
  }, [listedPriceLabel, highestBid]);

  const showSuccess = bid.step === "success" && bid.lastOutcome === "bid";
  const placedBidLabel = useMemo(() => {
    const raw = bid.price.replace(/[^0-9.]/g, "");
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return formatUsdc2(n);
  }, [bid.price, showSuccess]);

  useEffect(() => {
    onHeaderTitleChange?.(showSuccess ? "Bid placed" : "Place a bid");
  }, [showSuccess, onHeaderTitleChange]);

  const handleBidInput = (raw: string) => {
    setHintError(null);
    bid.priceTouchedRef.current = true;
    const digits = raw.replace(/[^0-9]/g, "");
    bid.setPrice(digits);
  };

  const handleAction = () => {
    setHintError(null);
    runTradeAccessGate(() => {
      if (!bid.priceOk) {
        setHintError("Enter a bid amount to continue.");
        return;
      }
      void bid.handleSubmit();
    });
  };

  const ctaLabel = !bid.address
    ? "Connect wallet to bid"
    : bid.walletSignerMissing
      ? "Open wallet…"
      : bid.busy
        ? bid.busyLabel
        : "Place bid";

  if (showSuccess) {
    return (
      <div className="cd-listing-checkout__done">
        <div className="cd-listing-checkout__done-icon" aria-hidden>
          <span>✓</span>
        </div>
        <div className="cd-listing-checkout__done-title">Bid submitted</div>
        <p className="cd-listing-checkout__done-msg">
          {placedBidLabel
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
            onChange={(e) => handleBidInput(e.target.value)}
            className="cd-listing-checkout__bid-input"
          />
        </div>
        <div
          className={`cd-listing-checkout__bid-hint tkl-mono${
            hintError || (bid.errorMsg && !bid.priceOk) ? " cd-listing-checkout__bid-hint--error" : ""
          }`}
          role={hintError || bid.errorMsg ? "alert" : undefined}
        >
          {hintError ?? bid.errorMsg ?? hintText}
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

      {bid.bidLimitMsg ? (
        <p className="cd-listing-checkout__bid-limit">{bid.bidLimitMsg}</p>
      ) : null}

      {bid.usdcInsufficientMsg ? (
        <p className="cd-listing-checkout__error" role="alert">
          {bid.usdcInsufficientMsg}
        </p>
      ) : null}

      {bid.errorMsg && bid.priceOk ? (
        <p className="cd-listing-checkout__error" role="alert">
          {bid.errorMsg}
        </p>
      ) : null}

      <TkButton
        type="button"
        variant="primary"
        className="cd-listing-checkout__cta"
        disabled={bid.busy || (Boolean(bid.address) && bid.submitDisabled && bid.priceOk)}
        onClick={handleAction}
      >
        {ctaLabel}
      </TkButton>

      <p className="cd-listing-checkout__fine tkl-mono">
        Settled on-chain · Asset stays vault-insured
      </p>

      <CollectionCriteriaBidFloorChooserModal
        open={
          bid.showAskChooserModal &&
          bid.crossesBook &&
          bid.lowestAskCandidates.length >= 2
        }
        lowestAskCandidates={bid.lowestAskCandidates}
        lowestAsk={bid.lowestAsk}
        lowestAskUsdc={bid.lowestAskUsdc}
        floorMetaByTokenId={bid.floorMetaByTokenId}
        busy={bid.busy}
        onClose={() => bid.setShowAskChooserModal(false)}
        onSelectAskHash={bid.setSelectedFloorAskHash}
        onConfirmBuy={() => runTradeAccessGate(() => void bid.handleSubmit())}
      />
    </>
  );
}
