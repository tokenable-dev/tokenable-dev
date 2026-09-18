"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";

/**
 * Card.html `#ob-bottom-bar` — viewport-fixed Buy / Bid / Sell strip
 * (ported to body so `isolation` on `.mobile-page-root` cannot offset
 * `position: fixed`).
 *
 * Layout (Card.html inline):
 *   Buy  flex:1      #2f6bff / white · label `Buy $9,000`
 *   Bid  flex:0 26%  #12305e / white
 *   Sell flex:0 26%  #fff / #2f6bff
 *   height 52 · weight 700 · gap 10
 */
export function CollectionMobileTradeBar({
  lowestAskUsd,
  onBuy,
  onBid,
  onSell,
  buyDisabled,
  bidDisabled,
  sellDisabled,
}: {
  lowestAskUsd?: number | null;
  onBuy: () => void;
  onBid: () => void;
  onSell: () => void;
  buyDisabled?: boolean;
  bidDisabled?: boolean;
  sellDisabled?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const hasAsk = lowestAskUsd != null && lowestAskUsd > 0;
  const buyLabel =
    hasAsk && lowestAskUsd != null
      ? `Buy $${Math.round(lowestAskUsd).toLocaleString("en-US")}`
      : "Buy";

  if (!mounted) return null;

  return createPortal(
    <div
      className="cd-mobile-trade-bar lg:hidden"
      id="ob-bottom-bar"
      role="region"
      aria-label="Trade actions"
    >
      <div className="cd-mobile-trade-bar__actions">
        <TkButton
          type="button"
          variant="primary"
          className="cd-mobile-trade-bar__buy"
          disabled={buyDisabled || !hasAsk}
          onClick={onBuy}
        >
          {buyLabel}
        </TkButton>
        <TkButton
          type="button"
          variant="primary"
          className="cd-mobile-trade-bar__bid"
          disabled={bidDisabled}
          onClick={onBid}
        >
          Bid
        </TkButton>
        <TkButton
          type="button"
          variant="primary"
          className="cd-mobile-trade-bar__sell"
          disabled={sellDisabled}
          onClick={onSell}
        >
          Sell
        </TkButton>
      </div>
    </div>,
    document.body,
  );
}
