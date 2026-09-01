"use client";

import type { ReactNode } from "react";
import { TkField, TkInput, TkSelect } from "@/components/ds";
import { AddressSearchField } from "@/components/shipping/AddressSearchField";
import type { ShippingCountry } from "@/lib/core/api/shipping-addresses";
import {
  PHONE_DIAL_CODE_VALUES,
  PHONE_DIAL_OPTIONS,
} from "@/lib/shipping/phoneDialOptions";
import {
  normalizeDialAndNational,
  type ShipToFieldErrors,
} from "@/lib/shipping/shipToValidation";

/** Shared ship-to fields — matches design system-5 Redeem address form. */
export type ShippingAddressFormValues = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  country: ShippingCountry;
  /** National number when `phoneDial` is set; otherwise full phone. */
  phone: string;
  /** Country dial when `showPhoneDial` (Redeem). */
  phoneDial?: string;
};

export function ShippingAddressFormFields({
  value,
  onChange,
  disabled = false,
  idPrefix = "ship",
  fieldErrors,
  showPhoneDial = false,
  extrasBefore,
  extrasAfter,
  showAddressSearch = true,
  addressSearchLabel = "Address",
}: {
  value: ShippingAddressFormValues;
  onChange: (next: ShippingAddressFormValues) => void;
  disabled?: boolean;
  idPrefix?: string;
  fieldErrors?: ShipToFieldErrors;
  /** Designer Redeem.html: dial select + national tel. */
  showPhoneDial?: boolean;
  /** Optional block inside the form (e.g. Label field in Settings). */
  extrasBefore?: ReactNode;
  extrasAfter?: ReactNode;
  showAddressSearch?: boolean;
  addressSearchLabel?: string;
}) {
  const set = <K extends keyof ShippingAddressFormValues>(
    key: K,
    next: ShippingAddressFormValues[K],
  ) => {
    onChange({ ...value, [key]: next });
  };

  const dial = value.phoneDial ?? "+1";

  const patchPhone = (nextDial: string, nextNational: string) => {
    const norm = normalizeDialAndNational(
      nextDial,
      nextNational,
      PHONE_DIAL_CODE_VALUES,
    );
    onChange({
      ...value,
      phoneDial: norm.phoneDial,
      phone: norm.phoneNational,
    });
  };

  return (
    <div className="tk-ship-form">
      {extrasBefore}

      {showAddressSearch ? (
        <div className="tk-ship-form__section">
          <AddressSearchField
            label={addressSearchLabel}
            disabled={disabled}
            line1FieldId={`${idPrefix}-line1`}
            onPick={(place) => {
              onChange({
                ...value,
                line1: place.line1,
                line2: place.line2,
                city: place.city,
                region: place.region,
                postal: place.postal,
                country: place.country,
                ...(showPhoneDial ? { phoneDial: place.phoneDial } : {}),
              });
            }}
          />
        </div>
      ) : null}

      <div className="tk-ship-form__section">
        <TkField
          label="Recipient name"
          htmlFor={`${idPrefix}-name`}
          error={fieldErrors?.name}
        >
          <TkInput
            id={`${idPrefix}-name`}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
            placeholder="Recipient name"
            disabled={disabled}
            hasError={Boolean(fieldErrors?.name)}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__section">
        <TkField
          label="Street address"
          htmlFor={`${idPrefix}-line1`}
          error={fieldErrors?.line1}
        >
          <TkInput
            id={`${idPrefix}-line1`}
            value={value.line1}
            onChange={(e) => set("line1", e.target.value)}
            autoComplete="address-line1"
            placeholder="Street address"
            className="tk-ship-form__street"
            disabled={disabled}
            hasError={Boolean(fieldErrors?.line1)}
          />
        </TkField>
        <TkField
          label="Apt, suite, unit (optional)"
          htmlFor={`${idPrefix}-line2`}
          className="tk-ship-form__apt"
        >
          <TkInput
            id={`${idPrefix}-line2`}
            value={value.line2}
            onChange={(e) => set("line2", e.target.value)}
            autoComplete="address-line2"
            placeholder="Apt, suite, unit (optional)"
            disabled={disabled}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField
            label="City"
            htmlFor={`${idPrefix}-city`}
            error={fieldErrors?.city}
          >
            <TkInput
              id={`${idPrefix}-city`}
              value={value.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              placeholder="City"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.city)}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField
            label="State / region"
            htmlFor={`${idPrefix}-region`}
            error={fieldErrors?.region}
          >
            <TkInput
              id={`${idPrefix}-region`}
              value={value.region}
              onChange={(e) => set("region", e.target.value)}
              autoComplete="address-level1"
              placeholder="State / region"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.region)}
            />
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField
            label="Postal code"
            htmlFor={`${idPrefix}-postal`}
            error={fieldErrors?.postal}
          >
            <TkInput
              id={`${idPrefix}-postal`}
              value={value.postal}
              onChange={(e) => set("postal", e.target.value)}
              autoComplete="postal-code"
              placeholder="Postal code"
              className="tk-ship-form__mono"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.postal)}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField label="Country" htmlFor={`${idPrefix}-country`} error={fieldErrors?.country}>
            <TkSelect
              id={`${idPrefix}-country`}
              value={value.country}
              onChange={(e) => {
                const country = e.target.value as ShippingCountry;
                if (showPhoneDial && (country === "us" || country === "ca")) {
                  onChange({
                    ...value,
                    country,
                    phoneDial: "+1",
                  });
                } else {
                  set("country", country);
                }
              }}
              disabled={disabled}
              hasError={Boolean(fieldErrors?.country)}
            >
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="intl">Other international</option>
            </TkSelect>
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__section">
        <TkField
          label="Phone"
          htmlFor={`${idPrefix}-phone`}
          error={fieldErrors?.phone}
        >
          {showPhoneDial ? (
            <div className="tk-ship-form__phone-row">
              <TkSelect
                id={`${idPrefix}-dial`}
                className="tk-ship-form__mono tk-ship-form__dial-select"
                wrapClassName="tk-ship-form__dial"
                value={dial}
                disabled={disabled}
                onChange={(e) => patchPhone(e.target.value, value.phone)}
                aria-label="Country dial code"
              >
                {PHONE_DIAL_OPTIONS.map((opt) => (
                  <option
                    key={`${opt.label}-${opt.value}`}
                    value={opt.value}
                    data-len={opt.len}
                  >
                    {opt.label}
                  </option>
                ))}
              </TkSelect>
              <TkInput
                id={`${idPrefix}-phone`}
                type="tel"
                inputMode="numeric"
                className="tk-ship-form__mono tk-ship-form__phone-national"
                value={value.phone}
                onChange={(e) => patchPhone(dial, e.target.value)}
                autoComplete="tel-national"
                placeholder="5550000000"
                disabled={disabled}
                hasError={Boolean(fieldErrors?.phone)}
              />
            </div>
          ) : (
            <TkInput
              id={`${idPrefix}-phone`}
              type="tel"
              className="tk-ship-form__mono"
              value={value.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
              placeholder="+1 555 000 0000"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.phone)}
            />
          )}
        </TkField>
      </div>

      {extrasAfter}
    </div>
  );
}
