"use client";

import { TkButton } from "@/components/ds";
import { OrderBookNotifyToggle } from "./OrderBookNotifyToggle";

export type OrderBookEmptyVariant = "no_asks" | "no_bids" | "no_market";

/**
 * Order book2 HTML empty states:
 * - no_asks: asks empty, bids live — Place a bid + Notify me toggle
 * - no_bids: bids empty, asks live — Place a bid
 * - no_market: both empty — List yours + Place a bid
 */
export function OrderBookEmptyPanel({
  variant,
  onPlaceBid,
  listingAlertActive,
  listingAlertPending,
  onToggleListingAlert,
  onListYours,
}: {
  variant: OrderBookEmptyVariant;
  onPlaceBid?: () => void;
  listingAlertActive?: boolean;
  listingAlertPending?: boolean;
  onToggleListingAlert?: () => void;
  onListYours?: () => void;
}) {
  if (variant === "no_asks") {
    return (
      <div className="cd-ob-empty cd-ob-empty--asks">
        <div className="cd-ob-empty__icon mono" aria-hidden>
          ◫
        </div>
        <h3 className="cd-ob-empty__title">No cards listed for sale yet</h3>
        <p className="cd-ob-empty__sub">
          No one is selling this card right now. Place a bid and we&apos;ll match you the
          moment a seller lists.
        </p>
        <div className="cd-ob-empty__btns">
          {onPlaceBid ? (
            <TkButton
              type="button"
              variant="primary"
              size="sm"
              className="cd-ob-empty__btn cd-ob-empty__btn--primary"
              onClick={onPlaceBid}
            >
              Place a bid
            </TkButton>
          ) : null}
          {onToggleListingAlert ? (
            <OrderBookNotifyToggle
              active={listingAlertActive ?? false}
              pending={listingAlertPending}
              onToggle={onToggleListingAlert}
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (variant === "no_bids") {
    return (
      <div className="cd-ob-empty cd-ob-empty--bids">
        <div className="cd-ob-empty__icon mono" aria-hidden>
          ◵
        </div>
        <h3 className="cd-ob-empty__title">No bids yet</h3>
        <p className="cd-ob-empty__sub">
          No one has made an offer on this card. Place a bid to set the market — sellers
          can accept it directly.
        </p>
        <div className="cd-ob-empty__btns">
          {onPlaceBid ? (
            <TkButton
              type="button"
              variant="primary"
              size="sm"
              className="cd-ob-empty__btn cd-ob-empty__btn--primary"
              onClick={onPlaceBid}
            >
              Place a bid
            </TkButton>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="cd-ob-empty cd-ob-empty--market">
      <div className="cd-ob-empty__icon mono" aria-hidden>
        ⬡
      </div>
      <h3 className="cd-ob-empty__title">No market yet for this card</h3>
      <p className="cd-ob-empty__sub">
        No asks or bids so far. Be the first to list yours, or place a bid to set the
        market.
      </p>
      <div className="cd-ob-empty__btns">
        {onListYours ? (
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="cd-ob-empty__btn cd-ob-empty__btn--primary"
            onClick={onListYours}
          >
            List yours
          </TkButton>
        ) : null}
        {onPlaceBid ? (
          <TkButton
            type="button"
            variant="neutral"
            size="sm"
            className="cd-ob-empty__btn cd-ob-empty__btn--ghost"
            onClick={onPlaceBid}
          >
            Place a bid
          </TkButton>
        ) : null}
      </div>
    </div>
  );
}
