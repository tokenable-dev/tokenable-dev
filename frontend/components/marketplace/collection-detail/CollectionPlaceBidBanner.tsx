"use client";

import { TkButton } from "@/components/ds";

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** Set-level Place a Bid banner — Card.html (design system-2). */
export function CollectionPlaceBidBanner({
  highestBidUsd,
  lowestAskUsd,
  onPlaceBid,
  disabled,
}: {
  highestBidUsd?: number | null;
  lowestAskUsd?: number | null;
  onPlaceBid: () => void;
  disabled?: boolean;
}) {
  const hasBid = highestBidUsd != null && highestBidUsd > 0;
  const hasAsk = lowestAskUsd != null && lowestAskUsd > 0;

  return (
    <div className="cd-place-bid-banner">
      <div className="cd-place-bid-banner__copy">
        <div className="cd-place-bid-banner__eyebrow">Name your price</div>
        <div className="cd-place-bid-banner__meta tkl-mono">
          Highest bid{" "}
          <span className={hasBid ? "cd-place-bid-banner__bid" : undefined}>
            {formatUsd(highestBidUsd)}
          </span>
          {" · "}
          Lowest ask{" "}
          <span className={hasAsk ? "cd-place-bid-banner__ask" : undefined}>
            {formatUsd(lowestAskUsd)}
          </span>
        </div>
        <p className="cd-place-bid-banner__sub">
          Place a standing order — it fills the moment a seller meets your price.
        </p>
      </div>
      <TkButton
        type="button"
        variant="primary"
        className="cd-place-bid-banner__cta"
        disabled={disabled}
        onClick={onPlaceBid}
      >
        Place a Bid
      </TkButton>
    </div>
  );
}
