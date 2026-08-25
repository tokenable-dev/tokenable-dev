"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";

/**
 * Card.html `#ob-bottom-bar` — viewport-fixed Buy / Bid strip (ported to body
 * so `isolation` on `.mobile-page-root` cannot offset `position: fixed`).
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
  if (!mounted) return null;

  return createPortal(
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
    </div>,
    document.body,
  );
}
