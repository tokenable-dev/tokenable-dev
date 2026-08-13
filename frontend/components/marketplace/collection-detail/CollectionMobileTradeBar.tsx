"use client";

import { TkButton } from "@/components/ds";

function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Card.html `#ob-bottom-bar` — fixed Buy / Bid strip on the mobile column
 * so trade actions stay reachable while scrolling.
 */
export function CollectionMobileTradeBar({
  lowestAskUsd,
  highestBidUsd,
  onBuy,
  onBid,
  buyDisabled,
  bidDisabled,
}: {
  lowestAskUsd?: number | null;
  highestBidUsd?: number | null;
  onBuy?: () => void;
  onBid: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
}) {
  const hasAsk = lowestAskUsd != null && lowestAskUsd > 0;
  const hasBid = highestBidUsd != null && highestBidUsd > 0;

  return (
    <div className="cd-mobile-trade-bar lg:hidden" role="region" aria-label="Trade actions">
      <div className="cd-mobile-trade-bar__meta tkl-mono">
        <span>
          Highest bid{" "}
          <b className={hasBid ? "cd-mobile-trade-bar__bid-val" : undefined}>
            {formatUsd(highestBidUsd)}
          </b>
        </span>
        <span>
          Lowest ask{" "}
          <b className={hasAsk ? "cd-mobile-trade-bar__ask-val" : undefined}>
            {formatUsd(lowestAskUsd)}
          </b>
        </span>
      </div>
      <div className="cd-mobile-trade-bar__actions">
        <TkButton
          type="button"
          variant="subtle"
          className="cd-mobile-trade-bar__bid bid-btn"
          disabled={bidDisabled}
          onClick={onBid}
        >
          Place a bid
        </TkButton>
        {onBuy ? (
          <TkButton
            type="button"
            variant="primary"
            className="cd-mobile-trade-bar__buy"
            disabled={buyDisabled || !hasAsk}
            onClick={onBuy}
          >
            {hasAsk ? `Buy now · ${formatUsd(lowestAskUsd)}` : "Buy now"}
          </TkButton>
        ) : null}
      </div>
    </div>
  );
}
