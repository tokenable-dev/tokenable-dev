"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Ship");
  const searchLabel =
    addressSearchLabel === "Delivery address"
      ? t("deliveryAddress")
      : addressSearchLabel === "Address"
        ? t("address")
        : addressSearchLabel;
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
            label={searchLabel}
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
          label={t("recipient")}
          htmlFor={`${idPrefix}-name`}
          error={fieldErrors?.name}
        >
          <TkInput
            id={`${idPrefix}-name`}
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
            placeholder={t("recipient")}
            disabled={disabled}
            hasError={Boolean(fieldErrors?.name)}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__section">
        <TkField
          label={t("street")}
          htmlFor={`${idPrefix}-line1`}
          error={fieldErrors?.line1}
        >
          <TkInput
            id={`${idPrefix}-line1`}
            value={value.line1}
            onChange={(e) => set("line1", e.target.value)}
            autoComplete="address-line1"
            placeholder={t("street")}
            className="tk-ship-form__street"
            disabled={disabled}
            hasError={Boolean(fieldErrors?.line1)}
          />
        </TkField>
        <TkField
          label={t("apt")}
          htmlFor={`${idPrefix}-line2`}
          className="tk-ship-form__apt"
        >
          <TkInput
            id={`${idPrefix}-line2`}
            value={value.line2}
            onChange={(e) => set("line2", e.target.value)}
            autoComplete="address-line2"
            placeholder={t("apt")}
            disabled={disabled}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField
            label={t("city")}
            htmlFor={`${idPrefix}-city`}
            error={fieldErrors?.city}
          >
            <TkInput
              id={`${idPrefix}-city`}
              value={value.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              placeholder={t("city")}
              disabled={disabled}
              hasError={Boolean(fieldErrors?.city)}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField
            label={t("region")}
            htmlFor={`${idPrefix}-region`}
            error={fieldErrors?.region}
          >
            <TkInput
              id={`${idPrefix}-region`}
              value={value.region}
              onChange={(e) => set("region", e.target.value)}
              autoComplete="address-level1"
              placeholder={t("region")}
              disabled={disabled}
              hasError={Boolean(fieldErrors?.region)}
            />
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField
            label={t("postal")}
            htmlFor={`${idPrefix}-postal`}
            error={fieldErrors?.postal}
          >
            <TkInput
              id={`${idPrefix}-postal`}
              value={value.postal}
              onChange={(e) => set("postal", e.target.value)}
              autoComplete="postal-code"
              placeholder={t("postal")}
              className="tk-ship-form__mono"
              disabled={disabled}
              hasError={Boolean(fieldErrors?.postal)}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField label={t("country")} htmlFor={`${idPrefix}-country`} error={fieldErrors?.country}>
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
              <option value="us">{t("unitedStates")}</option>
              <option value="ca">{t("canada")}</option>
              <option value="intl">{t("international")}</option>
            </TkSelect>
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__section">
        <TkField
          label={t("phone")}
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
                aria-label={t("dial")}
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
