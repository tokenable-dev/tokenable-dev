"use client";

import { useQuery } from "@tanstack/react-query";
import {
  TkButton,
  TkCheckbox,
  TkField,
  TkInput,
  TkSelect,
} from "@/components/ds";
import {
  formatRedeemUsd,
  getRedeemEstimate,
} from "@/lib/core/api/rwa-redeem";
import type {
  RedeemAddressForm,
  RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import type { RedeemShipTo } from "@/lib/core/api/rwa-redeem";
import { RedeemCardSummary } from "./RedeemCardSummary";

export function RedeemRequestPanel({
  cards,
  form,
  onChange,
  onRemoveCard,
  busy,
  error,
  onSubmit,
}: {
  cards: RedeemDraftCard[];
  form: RedeemAddressForm;
  onChange: (next: RedeemAddressForm) => void;
  onRemoveCard: (tokenId: number) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const set = <K extends keyof RedeemAddressForm>(key: K, value: RedeemAddressForm[K]) => {
    onChange({ ...form, [key]: value });
  };

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
      <div className="sell-flow-eyebrow">Redeem · Step 1 of 2</div>
      <h1 className="sell-flow-h1">Have your cards shipped to you</h1>
      <p className="sell-flow-sub">
        We&rsquo;ll ship your physical cards from the vault to the address below.
      </p>

      <div className="pf-redeem-form">
        <TkField label="Recipient name" htmlFor="redeem-name">
          <TkInput
            id="redeem-name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
            disabled={busy}
          />
        </TkField>
        <TkField label="Street address" htmlFor="redeem-line1">
          <TkInput
            id="redeem-line1"
            value={form.line1}
            onChange={(e) => set("line1", e.target.value)}
            autoComplete="address-line1"
            disabled={busy}
          />
        </TkField>
        <TkField label="Apt, suite, unit (optional)" htmlFor="redeem-line2">
          <TkInput
            id="redeem-line2"
            value={form.line2 ?? ""}
            onChange={(e) => set("line2", e.target.value)}
            autoComplete="address-line2"
            disabled={busy}
          />
        </TkField>
        <div className="pf-redeem-form__row">
          <TkField label="City" htmlFor="redeem-city">
            <TkInput
              id="redeem-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              disabled={busy}
            />
          </TkField>
          <TkField label="State / region" htmlFor="redeem-region">
            <TkInput
              id="redeem-region"
              value={form.region ?? ""}
              onChange={(e) => set("region", e.target.value)}
              autoComplete="address-level1"
              disabled={busy}
            />
          </TkField>
        </div>
        <div className="pf-redeem-form__row">
          <TkField label="Postal code" htmlFor="redeem-postal">
            <TkInput
              id="redeem-postal"
              value={form.postal}
              onChange={(e) => set("postal", e.target.value)}
              autoComplete="postal-code"
              disabled={busy}
            />
          </TkField>
          <TkField label="Country" htmlFor="redeem-country">
            <TkSelect
              id="redeem-country"
              value={form.country}
              onChange={(e) =>
                set("country", e.target.value as RedeemShipTo["country"])
              }
              disabled={busy}
            >
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="intl">Other international</option>
            </TkSelect>
          </TkField>
        </div>
        <TkField label="Phone" htmlFor="redeem-phone">
          <TkInput
            id="redeem-phone"
            type="tel"
            className="tkl-mono"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            placeholder="+1 555 000 0000"
            disabled={busy}
          />
        </TkField>
        <TkCheckbox
          label="Save this address for future redemptions"
          checked={form.saveAddress}
          onChange={(e) => set("saveAddress", e.target.checked)}
          disabled={busy}
        />
      </div>

      <RedeemCardSummary cards={cards} onRemove={onRemoveCard} />

      <div className="pf-redeem-cost">
        <div className="pf-redeem-cost__title">Estimated cost</div>
        <div className="pf-redeem-cost__lines tkl-mono">
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">Shipping &amp; handling</span>
            <span>
              {est
                ? formatRedeemUsd(est.shippingUsd)
                : estimateQuery.isLoading
                  ? "…"
                  : "—"}
            </span>
          </div>
          <div className="pf-redeem-cost__line">
            <span className="pf-redeem-cost__label">
              Redemption fee
              {est
                ? ` (${cards.length} × ${formatRedeemUsd(est.withdrawFeePerCardUsd)})`
                : ` × ${cards.length}`}
            </span>
            <span>
              {est
                ? formatRedeemUsd(est.withdrawFeeTotalUsd)
                : estimateQuery.isLoading
                  ? "…"
                  : "—"}
            </span>
          </div>
          <div className="pf-redeem-cost__line pf-redeem-cost__line--total">
            <span>Estimated total</span>
            <span>
              {est
                ? formatRedeemUsd(est.totalUsd)
                : estimateQuery.isLoading
                  ? "…"
                  : "Pending confirmation"}
            </span>
          </div>
        </div>
        <p className="pf-redeem-cost__copy">
          Estimate from PSA Vault withdraw + shipping rates — no markup. Shipping is
          charged once per shipment — the more cards you ship together, the less you
          pay per card. You&rsquo;ll pay the exact amount after we confirm it.
        </p>
        {form.country !== "us" ? (
          <p className="pf-redeem-cost__duty" role="note">
            Import duties, if any, are charged separately by the carrier on delivery.
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="pf-redeem-error" role="alert">
          {error}
        </p>
      ) : null}

      <TkButton
        type="button"
        variant="primary"
        className="pf-redeem-primary"
        disabled={busy || cards.length === 0}
        onClick={onSubmit}
      >
        {busy ? "Requesting…" : "Request redemption"}
      </TkButton>
    </div>
  );
}
