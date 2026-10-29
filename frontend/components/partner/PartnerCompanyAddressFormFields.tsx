"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TkField, TkInput, TkSelect } from "@/components/ds";
import { AddressSearchField } from "@/components/shipping/AddressSearchField";

export type PartnerCompanyAddressFormState = {
  companyName: string;
  contactName: string;
  phone: string;
  country: string;
  city: string;
  region: string;
  postal: string;
  line1: string;
  line2: string;
};

export const EMPTY_PARTNER_COMPANY_ADDRESS_FORM: PartnerCompanyAddressFormState =
  {
    companyName: "",
    contactName: "",
    phone: "",
    country: "US",
    city: "",
    region: "",
    postal: "",
    line1: "",
    line2: "",
  };

/** ISO-2 options for FedEx Origin (not redeem us/ca/intl buckets). */
export const PARTNER_COMPANY_COUNTRY_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "KR", label: "South Korea" },
  { value: "JP", label: "Japan" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "SG", label: "Singapore" },
];

export function partnerCompanyAddressFormToInput(
  form: PartnerCompanyAddressFormState,
) {
  return {
    companyName: form.companyName.trim(),
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    country: form.country.trim().toUpperCase(),
    city: form.city.trim(),
    region: form.region.trim() || null,
    postal: form.postal.trim(),
    line1: form.line1.trim(),
    line2: form.line2.trim() || null,
    residential: false as const,
  };
}

type PartnerAddressValidationKey =
  | "addrErrContact"
  | "addrErrStreet"
  | "addrErrCountry"
  | "addrErrRegion";

const PARTNER_ADDRESS_VALIDATION_EN: Record<PartnerAddressValidationKey, string> = {
  addrErrContact: "Company name, contact name, and phone are required.",
  addrErrStreet: "Street, city, and postal code are required.",
  addrErrCountry: "Country must be a 2-letter code (e.g. US).",
  addrErrRegion: "State / province is required for US and Canada.",
};

/** `translate` (e.g. `useTranslations("Partner")`) localizes messages; English when omitted. */
export function validatePartnerCompanyAddressForm(
  form: PartnerCompanyAddressFormState,
  translate?: (key: PartnerAddressValidationKey) => string,
): string | null {
  const msg = (key: PartnerAddressValidationKey) =>
    translate ? translate(key) : PARTNER_ADDRESS_VALIDATION_EN[key];
  const v = partnerCompanyAddressFormToInput(form);
  if (!v.companyName || !v.contactName || !v.phone) {
    return msg("addrErrContact");
  }
  if (!v.line1 || !v.city || !v.postal) {
    return msg("addrErrStreet");
  }
  if (!/^[A-Z]{2}$/.test(v.country)) {
    return msg("addrErrCountry");
  }
  if ((v.country === "US" || v.country === "CA") && !v.region) {
    return msg("addrErrRegion");
  }
  return null;
}

export function partnerCompanyAddressToForm(
  address: {
    companyName: string;
    contactName: string;
    phone: string;
    country: string;
    city: string;
    region: string | null;
    postal: string;
    line1: string;
    line2: string | null;
  } | null | undefined,
): PartnerCompanyAddressFormState {
  if (!address) return { ...EMPTY_PARTNER_COMPANY_ADDRESS_FORM };
  return {
    companyName: address.companyName ?? "",
    contactName: address.contactName ?? "",
    phone: address.phone ?? "",
    country: (address.country || "US").toUpperCase(),
    city: address.city ?? "",
    region: address.region ?? "",
    postal: address.postal ?? "",
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
  };
}

/**
 * Company Origin fields — same layout as `ShippingAddressFormFields`
 * (Settings Addresses / Redeem ship-to).
 */
export function PartnerCompanyAddressFormFields({
  value,
  onChange,
  disabled = false,
  idPrefix = "pv",
  extrasBefore,
  extrasAfter,
  /** When false, company name is omitted (caller puts it in extrasBefore). */
  showCompanyName = true,
}: {
  value: PartnerCompanyAddressFormState;
  onChange: (next: PartnerCompanyAddressFormState) => void;
  disabled?: boolean;
  idPrefix?: string;
  extrasBefore?: ReactNode;
  extrasAfter?: ReactNode;
  showCompanyName?: boolean;
}) {
  const t = useTranslations("Partner");
  const locale = useLocale();
  const countryName = (code: string, fallback: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) || fallback;
    } catch {
      return fallback;
    }
  };
  const set =
    (key: keyof PartnerCompanyAddressFormState) =>
    (next: string) =>
      onChange({ ...value, [key]: next });

  return (
    <div className="tk-ship-form">
      {extrasBefore}

      <div className="tk-ship-form__section">
        <AddressSearchField
          label={t("addrCompanyOrigin")}
          disabled={disabled}
          line1FieldId={`${idPrefix}-line1`}
          onPick={(place) => {
            const iso = place.countryIso2;
            const country = PARTNER_COMPANY_COUNTRY_OPTIONS.some(
              (o) => o.value === iso,
            )
              ? iso
              : value.country;
            onChange({
              ...value,
              line1: place.line1,
              line2: place.line2,
              city: place.city,
              region: place.region,
              postal: place.postal,
              country,
            });
          }}
        />
      </div>

      {showCompanyName ? (
        <div className="tk-ship-form__section">
          <TkField label={t("addrCompanyName")} htmlFor={`${idPrefix}-company`}>
            <TkInput
              id={`${idPrefix}-company`}
              value={value.companyName}
              onChange={(e) => set("companyName")(e.target.value)}
              autoComplete="organization"
              placeholder={t("addrCompanyName")}
              disabled={disabled}
            />
          </TkField>
        </div>
      ) : null}

      <div className="tk-ship-form__section">
        <TkField label={t("addrContactName")} htmlFor={`${idPrefix}-contact`}>
          <TkInput
            id={`${idPrefix}-contact`}
            value={value.contactName}
            onChange={(e) => set("contactName")(e.target.value)}
            autoComplete="name"
            placeholder={t("addrContactName")}
            disabled={disabled}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__section">
        <TkField label={t("addrStreet")} htmlFor={`${idPrefix}-line1`}>
          <TkInput
            id={`${idPrefix}-line1`}
            value={value.line1}
            onChange={(e) => set("line1")(e.target.value)}
            autoComplete="address-line1"
            placeholder={t("addrStreet")}
            className="tk-ship-form__street"
            disabled={disabled}
          />
        </TkField>
        <TkField
          label={t("addrApt")}
          htmlFor={`${idPrefix}-line2`}
          className="tk-ship-form__apt"
        >
          <TkInput
            id={`${idPrefix}-line2`}
            value={value.line2}
            onChange={(e) => set("line2")(e.target.value)}
            autoComplete="address-line2"
            placeholder={t("addrApt")}
            disabled={disabled}
          />
        </TkField>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField label={t("addrCity")} htmlFor={`${idPrefix}-city`}>
            <TkInput
              id={`${idPrefix}-city`}
              value={value.city}
              onChange={(e) => set("city")(e.target.value)}
              autoComplete="address-level2"
              placeholder={t("addrCity")}
              disabled={disabled}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField label={t("addrRegion")} htmlFor={`${idPrefix}-region`}>
            <TkInput
              id={`${idPrefix}-region`}
              value={value.region}
              onChange={(e) => set("region")(e.target.value)}
              autoComplete="address-level1"
              placeholder={t("addrRegion")}
              disabled={disabled}
            />
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__row">
        <div className="tk-ship-form__section">
          <TkField label={t("addrPostal")} htmlFor={`${idPrefix}-postal`}>
            <TkInput
              id={`${idPrefix}-postal`}
              value={value.postal}
              onChange={(e) => set("postal")(e.target.value)}
              autoComplete="postal-code"
              placeholder={t("addrPostal")}
              className="tk-ship-form__mono"
              disabled={disabled}
            />
          </TkField>
        </div>
        <div className="tk-ship-form__section">
          <TkField label={t("addrCountry")} htmlFor={`${idPrefix}-country`}>
            <TkSelect
              id={`${idPrefix}-country`}
              value={value.country}
              onChange={(e) => set("country")(e.target.value)}
              disabled={disabled}
            >
              {PARTNER_COMPANY_COUNTRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {countryName(o.value, o.label)}
                </option>
              ))}
            </TkSelect>
          </TkField>
        </div>
      </div>

      <div className="tk-ship-form__section">
        <TkField label={t("addrPhone")} htmlFor={`${idPrefix}-phone`}>
          <TkInput
            id={`${idPrefix}-phone`}
            type="tel"
            className="tk-ship-form__mono"
            value={value.phone}
            onChange={(e) => set("phone")(e.target.value)}
            autoComplete="tel"
            placeholder="+1 555 000 0000"
            disabled={disabled}
          />
        </TkField>
      </div>

      {extrasAfter}
    </div>
  );
}
