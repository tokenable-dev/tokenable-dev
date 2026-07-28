"use client";

import Link from "next/link";
import { TkButton, TkTag } from "@/components/ds";
import type { Order } from "@/lib/core";
import { listingVerifiedCollectorLabel } from "@/lib/marketplace/collectionListingModalHelpers";

function formatUsdc(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

export function CollectionListingOrderbookRow({
  tokenId,
  collectionKey,
  listing,
  imageUrl,
  gradeLabel,
  onOpenListing,
}: {
  tokenId: number;
  collectionKey: string;
  listing: Order;
  imageUrl?: string | null;
  gradeLabel?: string | null;
  onOpenListing?: (tokenId: number, action?: "view" | "buy" | "bid") => void;
}) {
  const fromQs = `fromCollection=${encodeURIComponent(collectionKey)}`;
  const detailHref = `/marketplace/${tokenId}?${fromQs}`;
  const price = formatUsdc(listing.considerationAmount);
  const seller = listingVerifiedCollectorLabel(listing);

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
        <div className="cd-listing-orderbook__seller tkl-mono" title={seller.title}>
          {seller.label}
        </div>
      </div>
      {gradeLabel ? (
        <TkTag tone="neutral" appearance="soft" className="cd-listing-orderbook__grade shrink-0">
          {gradeLabel}
        </TkTag>
      ) : null}
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
