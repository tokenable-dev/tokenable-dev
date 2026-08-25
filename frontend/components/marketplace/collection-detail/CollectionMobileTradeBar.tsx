"use client";

import { TkButton } from "@/components/ds";

/**
 * Card.html `#ob-bottom-bar` — fixed Buy / Bid strip on the mobile column
 * so trade actions stay reachable while scrolling.
 * Buy now stays visible when there is no ask — disabled instead of hidden.
 */
export function CollectionMobileTradeBar({
  lowestAskUsd,
  onBuy,
  onBid,
  buyDisabled,
  bidDisabled,
}: {
  lowestAskUsd?: number | null;
  onBuy: () => void;
  onBid: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
}) {
  const hasAsk = lowestAskUsd != null && lowestAskUsd > 0;

  return (
    <div className="cd-mobile-trade-bar lg:hidden" role="region" aria-label="Trade actions">
      <div className="cd-mobile-trade-bar__actions">
        <TkButton
          type="button"
          variant="primary"
          className="cd-mobile-trade-bar__buy"
          disabled={buyDisabled || !hasAsk}
          onClick={onBuy}
        >
          Buy now
        </TkButton>
        <TkButton
          type="button"
          variant="subtle"
          className="cd-mobile-trade-bar__bid bid-btn"
          disabled={bidDisabled}
          onClick={onBid}
        >
          Bid
        </TkButton>
      </div>
    </div>
  );
}
