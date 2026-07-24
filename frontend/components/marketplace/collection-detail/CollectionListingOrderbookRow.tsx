"use client";

import Link from "next/link";
import { TkButton, TkTag } from "@/components/ds";
import type { Order } from "@/lib/core";

function formatUsdc(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

function shortenAddr(addr: string | undefined): string {
  const s = (addr ?? "").trim().toLowerCase();
  if (!s.startsWith("0x") || s.length < 12) return "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
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
  const bidHref = `${detailHref}&bid=1`;
  const price = formatUsdc(listing.considerationAmount);
  const sellerAddr = listing.offerer || listing.parameters?.offerer;
  const seller =
    listing.sellerDisplayName?.trim() || shortenAddr(sellerAddr);

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
        <div className="cd-listing-orderbook__seller">{seller}</div>
      </div>
      {gradeLabel ? (
        <TkTag tone="neutral" appearance="soft" className="cd-listing-orderbook__grade shrink-0">
          {gradeLabel}
        </TkTag>
      ) : null}
      <div className="cd-listing-orderbook__actions">
        {onOpenListing ? (
          <>
            <TkButton
              type="button"
              variant="primary"
              size="sm"
              className="cd-listing-orderbook__btn"
              onClick={() => onOpenListing(tokenId, "buy")}
            >
              Buy
            </TkButton>
            <TkButton
              type="button"
              variant="subtle"
              size="sm"
              className="cd-listing-orderbook__btn"
              onClick={() => onOpenListing(tokenId, "bid")}
            >
              Bid
            </TkButton>
          </>
        ) : (
          <>
            <TkButton variant="primary" size="sm" href={detailHref} className="cd-listing-orderbook__btn">
              Buy
            </TkButton>
            <TkButton variant="subtle" size="sm" href={bidHref} className="cd-listing-orderbook__btn">
              Bid
            </TkButton>
          </>
        )}
      </div>
    </div>
  );
}
