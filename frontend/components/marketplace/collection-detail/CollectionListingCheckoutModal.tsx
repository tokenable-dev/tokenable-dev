"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Order, RwaMetadata } from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useAccount } from "wagmi";
import {
  formatListingUsdc,
  listingAssetTitle,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { CollectionListingBidCheckout } from "./CollectionListingBidCheckout";

export function CollectionListingCheckoutModal({
  open,
  mode,
  tokenId,
  listing,
  metadata,
  imageUrl,
  collectionKey,
  collectionAsks,
  collectionBids = [],
  connectedAddress,
  buyBusy,
  buyErr,
  onClose,
  onFulfillBuy,
  onBidPlaced,
  onPurchaseFilled,
}: {
  open: boolean;
  mode: "buy" | "bid";
  tokenId: number | null;
  listing: Order | null;
  metadata: RwaMetadata | null;
  imageUrl: string | null;
  collectionKey: string;
  collectionAsks: Order[];
  collectionBids?: Order[];
  connectedAddress?: string;
  buyBusy: boolean;
  buyErr: string | null;
  onClose: () => void;
  onFulfillBuy: () => void;
  onBidPlaced?: () => void;
  onPurchaseFilled?: () => void;
}) {
  const { runTradeAccessGate } = useTradeAccessGate(
    `/marketplace/collections/${encodeURIComponent(collectionKey)}`,
  );
  const { isConnected } = useAccount();
  const [bidHeaderTitle, setBidHeaderTitle] = useState("Place a bid");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && mode === "bid") setBidHeaderTitle("Place a bid");
  }, [open, mode]);

  if (!open || tokenId == null || !listing || typeof document === "undefined") {
    return null;
  }

  const price = formatListingUsdc(listing.considerationAmount);
  const title = listingAssetTitle(metadata, tokenId);
  const fee = "15.00";
  const total =
    mode === "buy"
      ? (Number(price.replace(/,/g, "")) + Number(fee)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : price;

  const handlePay = () => {
    runTradeAccessGate(() => onFulfillBuy());
  };

  return createPortal(
    <div
      className="cd-listing-checkout"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cd-listing-checkout-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cd-listing-checkout__panel cd-notch">
        <div className="cd-listing-checkout__head">
          <h2 id="cd-listing-checkout-title" className="cd-listing-checkout__title">
            {mode === "buy" ? "Checkout" : bidHeaderTitle}
          </h2>
          <button
            type="button"
            className="cd-listing-checkout__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="cd-listing-checkout__item">
          <div className="cd-listing-checkout__item-thumb">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" />
            ) : null}
          </div>
          <div className="cd-listing-checkout__item-meta">
            <div className="cd-listing-checkout__item-title">{title}</div>
            <div className="cd-listing-checkout__item-sub tkl-mono">
              Listed ${price} · Vaulted
            </div>
          </div>
        </div>

        {mode === "buy" ? (
          <>
            <div className="cd-listing-checkout__rows">
              <div className="cd-listing-checkout__row">
                <span>Item price</span>
                <span className="tkl-mono">${price}.00</span>
              </div>
              <div className="cd-listing-checkout__row">
                <span>Network &amp; settlement fee</span>
                <span className="tkl-mono">${fee}</span>
              </div>
              <div className="cd-listing-checkout__row cd-listing-checkout__row--total">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </div>
            {buyErr ? (
              <p className="cd-listing-checkout__error" role="alert">
                {buyErr}
              </p>
            ) : null}
            <TkButton
              type="button"
              variant="primary"
              className="cd-listing-checkout__cta"
              disabled={buyBusy}
              onClick={handlePay}
            >
              {buyBusy
                ? "Processing…"
                : isConnected
                  ? "Confirm purchase"
                  : "Connect wallet to pay"}
            </TkButton>
            <p className="cd-listing-checkout__fine tkl-mono">
              Settled on-chain · Asset stays vault-insured
            </p>
          </>
        ) : (
          <CollectionListingBidCheckout
            collectionKey={collectionKey}
            tokenId={tokenId}
            listing={listing}
            collectionBids={collectionBids}
            listedPriceLabel={`${price}.00`}
            connectedAddress={connectedAddress}
            onHeaderTitleChange={setBidHeaderTitle}
            onPlaced={() => onBidPlaced?.()}
            onPurchaseFilled={() => onPurchaseFilled?.()}
            onDone={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
