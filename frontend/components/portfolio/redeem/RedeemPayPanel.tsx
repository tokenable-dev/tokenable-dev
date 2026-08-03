"use client";

import { useQuery } from "@tanstack/react-query";
import { TkButton } from "@/components/ds";
import {
  formatRedeemUsd,
  getRedeemEstimate,
} from "@/lib/core/api/rwa-redeem";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import { RedeemCardSummary } from "./RedeemCardSummary";

/** Phase B skeleton — payment domain not live yet. */
export function RedeemPayPanel({
  cards,
  form,
  onEditAddress,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  onEditAddress: () => void;
}) {
  const estimateQuery = useQuery({
    queryKey: ["rwa", "redeem", "estimate", form.country, cards.length],
    queryFn: () =>
      getRedeemEstimate({ country: form.country, cardCount: Math.max(1, cards.length) }),
    enabled: cards.length > 0,
    staleTime: 60_000,
  });
  const est = estimateQuery.data;

  return (
    <div className="pf-redeem-panel">
      <div className="sell-flow-eyebrow">Redeem · Step 2 of 2</div>
      <h1 className="sell-flow-h1">Confirm &amp; pay</h1>
      <p className="sell-flow-sub">
        The cost is confirmed. Pay to start your shipment.
      </p>

      <RedeemCardSummary cards={cards} />

      <div className="pf-redeem-cost">
        <div className="pf-redeem-cost__title">Confirmed cost</div>
        <div className="pf-redeem-cost__lines tkl-mono">
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">Shipping &amp; handling</span>
            <span>{est ? formatRedeemUsd(est.shippingUsd) : "—"}</span>
          </div>
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">
              Redemption fee
              {est
                ? ` (${cards.length} × ${formatRedeemUsd(est.withdrawFeePerCardUsd)})`
                : ` × ${cards.length}`}
            </span>
            <span>{est ? formatRedeemUsd(est.withdrawFeeTotalUsd) : "—"}</span>
          </div>
          <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
            <span>Total</span>
            <span>{est ? formatRedeemUsd(est.totalUsd) : "Pending ops"}</span>
          </div>
        </div>
        <p className="pf-redeem-cost__copy">
          Matches PSA Vault withdraw + shipping rates — no markup. USDC payment ships
          after ops confirms pricing.
        </p>
      </div>

      <div className="pf-redeem-shipto">
        <div className="pf-redeem-shipto__head">
          <span>Ship to</span>
          <button type="button" className="pf-redeem-summary__toggle" onClick={onEditAddress}>
            Edit
          </button>
        </div>
        <p className="pf-redeem-shipto__body">
          {form.name}
          <br />
          {form.line1}
          {form.line2 ? (
            <>
              <br />
              {form.line2}
            </>
          ) : null}
          <br />
          {form.city}
          {form.region ? `, ${form.region}` : ""} {form.postal}
        </p>
      </div>

      <div className="pf-redeem-paybox">
        <div className="pf-redeem-cost__title">Payment</div>
        <p className="pf-redeem-paybox__copy">
          Wallet balance <span className="tkl-mono pf-redeem-paybox__bal">— USDC</span>
        </p>
        <p className="pf-redeem-cost__copy">
          USDC payment ships in a later update after ops confirms pricing.
        </p>
      </div>

      <TkButton type="button" variant="primary" className="pf-redeem-primary" disabled>
        Pay and redeem (coming soon)
      </TkButton>
    </div>
  );
}
