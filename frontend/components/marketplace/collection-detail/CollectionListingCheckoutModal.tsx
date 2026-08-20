"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMerkleEligibleTokenIds,
  marketplaceRqPolicy,
  rq,
  type Order,
  type RwaMetadata,
} from "@/lib/core";
import { TkButton } from "@/components/ds";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useAccount } from "wagmi";
import {
  formatListingUsdc,
  listingAssetTitle,
  listingVerificationTiles,
  stubListingForOffer,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { CollectionListingBidCheckout } from "./CollectionListingBidCheckout";

export function CollectionListingCheckoutModal({
  open,
  mode,
  tokenId,
  listing,
  metadata,
  imageUrl,
  collectionTitle,
  collectionKey,
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
  collectionTitle?: string | null;
  collectionKey: string;
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

  const needsCollectionToken = open && mode === "bid" && listing == null;
  const merkleQuery = useQuery({
    queryKey: rq.merkleSet(collectionKey),
    queryFn: () => getMerkleEligibleTokenIds(collectionKey),
    enabled: needsCollectionToken,
    staleTime: marketplaceRqPolicy.merkleSetStaleMs,
  });

  const resolvedTokenId = useMemo(() => {
    if (tokenId != null && Number.isFinite(tokenId) && tokenId >= 0) return tokenId;
    const ids = merkleQuery.data?.tokenIds ?? [];
    const sorted = [...ids].map(Number).filter((n) => Number.isFinite(n));
    sorted.sort((a, b) => a - b);
    return sorted[0] ?? null;
  }, [tokenId, merkleQuery.data]);

  const resolvedListing = useMemo(() => {
    if (listing) return listing;
    if (resolvedTokenId == null) return null;
    return stubListingForOffer(resolvedTokenId, collectionKey);
  }, [listing, resolvedTokenId, collectionKey]);

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

  const buyReady = mode === "buy" && tokenId != null && listing != null;
  if (!open || typeof document === "undefined") return null;
  if (mode === "buy" && !buyReady) return null;

  const hasLiveAsk = listing != null && Number(listing.considerationAmount) > 0;
  const tiles = listingVerificationTiles(metadata);
  const itemSub = hasLiveAsk
    ? [tiles.gradedBy, tiles.certNumber !== "—" ? `Cert ${tiles.certNumber}` : null, "Vaulted"]
        .filter(Boolean)
        .join(" · ")
    : [tiles.gradedBy !== "—" ? tiles.gradedBy : null, "No active listing"]
        .filter(Boolean)
        .join(" · ");
  const price = listing ? formatListingUsdc(listing.considerationAmount) : "—";
  const title =
    collectionTitle?.trim() ||
    (resolvedTokenId != null
      ? listingAssetTitle(metadata, resolvedTokenId)
      : "Collection");
  const priceLabel = (() => {
    const n = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(n)) return price;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();

  const handlePay = () => {
    runTradeAccessGate(() => onFulfillBuy());
  };

  const merklePending = needsCollectionToken && merkleQuery.isLoading;
  const merkleEmpty =
    needsCollectionToken && !merkleQuery.isLoading && resolvedTokenId == null;

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
              {itemSub}
            </div>
          </div>
        </div>

        {mode === "buy" && listing ? (
          <>
            <div className="cd-listing-checkout__rows">
              <div className="cd-listing-checkout__row">
                <span>Item price</span>
                <span className="tkl-mono">${priceLabel}</span>
              </div>
              <div className="cd-listing-checkout__row cd-listing-checkout__row--total">
                <span>Total (USDC)</span>
                <span>${priceLabel}</span>
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
              Owned instantly · stays safely in the vault. Network gas is paid
              separately in the chain&apos;s native token.
            </p>
          </>
        ) : merklePending ? (
          <p className="cd-listing-checkout__fine tkl-mono">Loading collection…</p>
        ) : merkleEmpty ? (
          <p className="cd-listing-checkout__error" role="alert">
            There are no vaulted cards in this collection yet, so a bid can&apos;t be
            placed.
          </p>
        ) : resolvedTokenId != null && resolvedListing ? (
          <CollectionListingBidCheckout
            collectionKey={collectionKey}
            tokenId={resolvedTokenId}
            listing={resolvedListing}
            collectionBids={collectionBids}
            listedPriceLabel={hasLiveAsk ? priceLabel : null}
            connectedAddress={connectedAddress}
            onHeaderTitleChange={setBidHeaderTitle}
            onPlaced={() => onBidPlaced?.()}
            onPurchaseFilled={() => onPurchaseFilled?.()}
            onDone={onClose}
          />
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
