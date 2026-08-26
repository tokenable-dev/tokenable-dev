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
import { useAppStore } from "@/store";
import {
  formatListingUsdc,
  listingAssetTitle,
  listingVerificationTiles,
  stubListingForOffer,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { resolveRwaHeadlineGrade } from "@/lib/marketplace/assetDetailHeadline";
import { CollectionListingBidCheckout } from "./CollectionListingBidCheckout";

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

export function CollectionListingCheckoutModal({
  open,
  mode,
  tokenId,
  listing,
  metadata,
  imageUrl,
  collectionTitle,
  collectionMeta,
  collectionGradeLine,
  collectionKey,
  collectionBids = [],
  askUsd,
  highestBidUsd,
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
  /** Year · Set · Variant — shown under the title on Place a bid / Checkout. */
  collectionMeta?: string | null;
  /** Card.html #tkb-copy for collection-level bid — e.g. `PSA 10 · Gem Mint`. */
  collectionGradeLine?: string | null;
  collectionKey: string;
  collectionBids?: Order[];
  /** Collection lowest ask for bid modal Ask price card. */
  askUsd?: number | null;
  /** Collection highest bid for bid modal Highest bid card. */
  highestBidUsd?: number | null;
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
  const { isConnected, address: walletAddress } = useAccount();
  const usdcBalanceFormatted = useAppStore((s) => s.usdcBalanceFormatted);
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

  const buyPricing = useMemo(() => {
    if (!listing || mode !== "buy") return null;
    try {
      // Buyer pays listed consideration only. Platform fee is taken from seller proceeds
      // (computeFeeSplit), not added on top for the buyer.
      const totalUnits = BigInt(listing.considerationAmount);
      const itemUsd = Number(totalUnits) / 1_000_000;
      return { itemUsd, totalUsd: itemUsd };
    } catch {
      return null;
    }
  }, [listing, mode]);

  const payLabel = useMemo(() => {
    if (buyBusy) return "Processing…";
    if (!isConnected) return "Connect wallet to pay";
    if (buyPricing) return `Pay $${formatUsdc2(buyPricing.totalUsd)}`;
    return "Confirm purchase";
  }, [buyBusy, isConnected, buyPricing]);

  const buyReady = mode === "buy" && tokenId != null && listing != null;
  if (!open || typeof document === "undefined") return null;
  if (mode === "buy" && !buyReady) return null;

  const hasLiveAsk = listing != null && Number(listing.considerationAmount) > 0;
  const tiles = listingVerificationTiles(metadata);
  const grade = resolveRwaHeadlineGrade(metadata);
  /** Card.html #tkb-copy — buy: cert line; bid: grade line or collection meta. */
  const itemSub =
    mode === "buy" && hasLiveAsk
      ? [
          grade,
          tiles.certNumber !== "—" ? `Cert ${tiles.certNumber}` : null,
          "Vaulted",
        ]
          .filter(Boolean)
          .join(" · ")
      : mode === "bid"
        ? (
            collectionGradeLine?.trim() ||
            [
              grade,
              tiles.certNumber !== "—" ? `Cert ${tiles.certNumber}` : null,
              hasLiveAsk ? "Vaulted" : null,
            ]
              .filter(Boolean)
              .join(" · ") ||
            collectionMeta?.trim() ||
            ""
          )
        : [
            collectionMeta?.trim() || null,
            ...(hasLiveAsk
              ? [
                  tiles.gradedBy !== "—" ? tiles.gradedBy : null,
                  tiles.certNumber !== "—" ? `Cert ${tiles.certNumber}` : null,
                  "Vaulted",
                ]
              : [
                  tiles.gradedBy !== "—" ? tiles.gradedBy : null,
                  "No active listing",
                ]),
          ]
            .filter(Boolean)
            .join(" · ");
  const price = listing ? formatListingUsdc(listing.considerationAmount) : "—";
  /** Buy: collection title without grade (Card.html #tk-buy). Bid: same fallback. */
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
    if (!isConnected) {
      runTradeAccessGate();
      return;
    }
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
            <div
              className={`cd-listing-checkout__item-sub${
                mode === "buy" || mode === "bid"
                  ? " cd-listing-checkout__item-sub--copy tkl-mono"
                  : ""
              }`}
            >
              {itemSub}
            </div>
          </div>
        </div>

        {mode === "buy" && listing ? (
          <>
            <div className="cd-listing-checkout__rows">
              <div className="cd-listing-checkout__row">
                <span>Item price</span>
                <span className="tkl-mono">
                  ${formatUsdc2((buyPricing?.itemUsd ?? Number(priceLabel.replace(/,/g, ""))) || 0)}
                </span>
              </div>
            </div>

            {!isConnected ? (
              <div className="cd-listing-checkout__wallet cd-listing-checkout__wallet--disconnected">
                <span className="cd-listing-checkout__wallet-dot" aria-hidden />
                <span>No wallet connected — connect to continue</span>
              </div>
            ) : walletAddress ? (
              <div className="cd-listing-checkout__wallet cd-listing-checkout__wallet--connected">
                <span className="cd-listing-checkout__wallet-id">
                  <span className="cd-listing-checkout__wallet-icon" aria-hidden />
                  <span className="tkl-mono">{shortWallet(walletAddress)}</span>
                </span>
                <span className="cd-listing-checkout__wallet-balance tkl-mono">
                  {Number(usdcBalanceFormatted).toLocaleString("en-US")} USDC
                </span>
              </div>
            ) : null}

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
              {payLabel}
            </TkButton>
            <p className="cd-listing-checkout__fine tkl-mono">
              Owned instantly · stays safely in the vault
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
            askUsd={askUsd}
            highestBidUsd={highestBidUsd}
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
