"use client";

import Link from "next/link";
import { TkButton } from "@/components/ds";
import type { Order } from "@/lib/core";
import { formatUsdcAtomicAmount } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { listingVaultBadge } from "@/lib/marketplace/collectionListingModalHelpers";

export function CollectionListingOrderbookRow({
  tokenId,
  collectionKey,
  listing,
  imageUrl,
  onOpenListing,
}: {
  tokenId: number;
  collectionKey: string;
  listing: Order;
  imageUrl?: string | null;
  onOpenListing?: (tokenId: number, action?: "view" | "buy" | "bid") => void;
}) {
  const fromQs = `fromCollection=${encodeURIComponent(collectionKey)}`;
  const detailHref = `/marketplace/${tokenId}?${fromQs}`;
  const price = formatUsdcAtomicAmount(listing.considerationAmount);
  const vault = listingVaultBadge(listing);

  const thumb = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="cd-listing-orderbook__thumb" />
  ) : (
    <div className="cd-listing-orderbook__thumb cd-listing-orderbook__thumb--empty" />
  );

  return (
    <div className="cd-listing-orderbook__row">
      {onOpenListing ? (
        <button
          type="button"
          className="cd-listing-orderbook__thumb-link"
          onClick={() => onOpenListing(tokenId, "view")}
        >
          {thumb}
        </button>
      ) : (
        <Link href={detailHref} className="cd-listing-orderbook__thumb-link">
          {thumb}
        </Link>
      )}
      <div className="cd-listing-orderbook__meta">
        <div className="cd-listing-orderbook__price">${price}</div>
        <div
          className={`cd-listing-orderbook__seller tkl-mono cd-listing-orderbook__vault--${vault.tone}`}
          title={vault.title}
        >
          {vault.label}
        </div>
      </div>
      <div className="cd-listing-orderbook__actions">
        {onOpenListing ? (
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="cd-listing-orderbook__btn"
            onClick={() => onOpenListing(tokenId, "buy")}
          >
            Buy
          </TkButton>
        ) : (
          <TkButton variant="primary" size="sm" href={detailHref} className="cd-listing-orderbook__btn">
            Buy
          </TkButton>
        )}
      </div>
    </div>
  );
}
