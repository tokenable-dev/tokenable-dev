"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Order, RwaMetadata } from "@/lib/core";
import { CollectionListingBidCheckout } from "@/components/marketplace/collection-detail/CollectionListingBidCheckout";
import {
  formatListingUsdc,
  listingVerificationTiles,
  stubListingForOffer,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";

export function RwaDetailPlaceBidModal({
  open,
  assetTitle,
  assetMeta,
  tokenId,
  collectionKey,
  listing,
  collectionBids,
  connectedAddress,
  imageUrl,
  metadata,
  onClose,
  onPlaced,
  onPurchaseFilled,
}: {
  open: boolean;
  assetTitle: string;
  /** Year · Set · Variant under the title. */
  assetMeta?: string | null;
  tokenId: number;
  collectionKey: string;
  listing: Order | null;
  collectionBids: Order[];
  connectedAddress?: string;
  imageUrl?: string | null;
  metadata?: RwaMetadata | null;
  onClose: () => void;
  onPlaced?: () => void;
  onPurchaseFilled?: () => void;
}) {
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

  if (!open || typeof document === "undefined") return null;

  const floorListing = listing ?? stubListingForOffer(tokenId, collectionKey);
  const listedPriceLabel =
    listing != null ? `${formatListingUsdc(listing.considerationAmount)}.00` : null;
  const tiles = listingVerificationTiles(metadata ?? null);
  const catalogMeta = assetMeta?.trim() || null;
  const itemSub = [
    catalogMeta,
    tiles.gradedBy !== "—" ? tiles.gradedBy : null,
    tiles.certNumber !== "—" ? `Cert ${tiles.certNumber}` : null,
    listing ? "Vaulted" : "No active listing",
  ]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div
      className="cd-listing-checkout"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rwa-place-bid-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cd-listing-checkout__panel cd-notch">
        <div className="cd-listing-checkout__head">
          <h2 id="rwa-place-bid-title" className="cd-listing-checkout__title">
            Place a bid
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
            <div className={`cd-listing-checkout__item-title ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}>
              {assetTitle}
            </div>
            <div className="cd-listing-checkout__item-sub">{itemSub}</div>
          </div>
        </div>

        <CollectionListingBidCheckout
          collectionKey={collectionKey}
          tokenId={tokenId}
          listing={floorListing}
          collectionBids={collectionBids}
          listedPriceLabel={listedPriceLabel}
          connectedAddress={connectedAddress}
          onPlaced={() => onPlaced?.()}
          onPurchaseFilled={() => onPurchaseFilled?.()}
          onDone={onClose}
        />
      </div>
    </div>,
    document.body,
  );
}
