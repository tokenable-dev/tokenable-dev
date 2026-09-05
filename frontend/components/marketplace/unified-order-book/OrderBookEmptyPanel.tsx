"use client";

import { TkButton } from "@/components/ds";
import { OrderBookNotifyToggle } from "./OrderBookNotifyToggle";

export type OrderBookEmptyVariant = "no_asks" | "no_bids" | "no_market";

/**
 * Order book split-scroll empty states (design HTML `.emptyPane`):
 * compact horizontal row — colored side dot + title + actions.
 * - no_asks: asks empty, bids live — Place a bid + Notify me
 * - no_bids: bids empty, asks live — Place a bid
 * - no_market: both empty — List yours + Place a bid (tall, centered)
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
        <span className="cd-ob-empty__dot" aria-hidden />
        <div className="cd-ob-empty__title">No cards for sale yet</div>
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
        <span className="cd-ob-empty__dot" aria-hidden />
        <div className="cd-ob-empty__title">No bids yet</div>
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
      <span className="cd-ob-empty__dot" aria-hidden />
      <div className="cd-ob-empty__title">No market yet</div>
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
