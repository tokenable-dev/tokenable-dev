"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";

/**
 * Card.html `#ob-bottom-bar` — viewport-fixed Buy / Bid strip
 * (ported to body so `isolation` on `.mobile-page-root` cannot offset
 * `position: fixed`).
 *
 * Layout: Buy and Bid each take half the row.
 *   Buy  #1A6FFF / white · label `Buy $9,000`
 *   Bid  #12305e / white
 *   height 52 · font 15/700 · gap 10
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
      className="cd-mobile-trade-bar min-[1141px]:hidden"
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
      </div>
    </div>,
    document.body,
  );
}
