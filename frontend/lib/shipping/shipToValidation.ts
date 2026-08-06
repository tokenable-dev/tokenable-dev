import type { ShippingCountry } from "@/lib/core/api/shipping-addresses";

export type ShipToFieldKey =
  | "name"
  | "line1"
  | "city"
  | "region"
  | "postal"
  | "phone";

export type ShipToFieldErrors = Partial<Record<ShipToFieldKey, string>>;

export type ShipToValidateInput = {
  name: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: ShippingCountry;
  /** National digits / local formatting (no country dial). */
  phone: string;
  phoneDial: string;
  /** `data-len` from dial option, e.g. `"10"` or `"9,10"`. */
  phoneDialLens: string;
};

const POSTAL: Record<
  ShippingCountry,
  { re: RegExp; msg: string }
> = {
  us: {
    re: /^\d{5}(-\d{4})?$/,
    msg: "Enter a 5-digit ZIP code (e.g. 94103)",
  },
  ca: {
    re: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
    msg: "Enter a Canadian postal code (e.g. M5V 2T6)",
  },
  intl: {
    re: /^[A-Za-z0-9][A-Za-z0-9 -]{2,11}$/,
    msg: "Enter a valid postal code",
  },
};

function phoneLengthOk(digits: string, lensCsv: string): boolean {
  const lens = lensCsv
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (lens.length === 0) {
    return digits.length >= 7 && digits.length <= 15;
  }
  if (lens.length === 2 && lens[1]! - lens[0]! > 1) {
    return digits.length >= lens[0]! && digits.length <= lens[1]!;
  }
  return lens.includes(digits.length);
}

/** Field-level rules from designer Redeem.html (postal + dial length). */
export function validateShipToFields(
  input: ShipToValidateInput,
): ShipToFieldErrors {
  const errors: ShipToFieldErrors = {};
  if (input.name.trim().length <= 1) {
    errors.name = "Enter the recipient’s name";
  }
  if (input.line1.trim().length <= 3) {
    errors.line1 = "Enter a street address";
  }
  if (input.city.trim().length <= 1) {
    errors.city = "Enter a city";
  }
  if (input.region.trim().length === 0) {
    errors.region = "Enter a state or region";
  }

  const postalRule = POSTAL[input.country] ?? POSTAL.intl;
  if (!postalRule.re.test(input.postal.trim())) {
    errors.postal = postalRule.msg;
  }

  const digits = input.phone.replace(/[^\d]/g, "");
  const lens = input.phoneDialLens || "7,15";
  if (!phoneLengthOk(digits, lens)) {
    const parts = lens.split(",").map((s) => s.trim()).filter(Boolean);
    const lenHint =
      parts.length === 1
        ? `${parts[0]}-digit`
        : `${parts.join(" or ")}-digit`;
    const dial = input.phoneDial ? `${input.phoneDial} ` : "";
    errors.phone = `Enter a valid ${lenHint} number for ${dial || "the selected country"}`;
  }

  return errors;
}

export function firstShipToErrorKey(
  errors: ShipToFieldErrors,
): ShipToFieldKey | null {
  const order: ShipToFieldKey[] = [
    "name",
    "line1",
    "city",
    "region",
    "postal",
    "phone",
  ];
  return order.find((k) => errors[k]) ?? null;
}

/** Digits only for national number display / length checks. */
export function nationalPhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export function composeShipToPhone(
  phoneDial: string,
  national: string,
  dialCodes: readonly string[] = [],
): string {
  const codes = dialCodes.length > 0 ? dialCodes : [phoneDial || "+1"];
  const { phoneDial: d, phoneNational: n } = normalizeDialAndNational(
    phoneDial || "+1",
    national,
    codes,
  );
  if (!n) return d;
  return `${d} ${n}`.trim();
}

/**
 * Split a stored phone into dial + national for the form.
 * Longest dial match wins (e.g. +998 before +9).
 * National is returned as digits only (no leftover dial / "+").
 */
export function splitShipToPhone(
  phone: string,
  dialCodes: readonly string[],
): { phoneDial: string; phoneNational: string } {
  const raw = phone.trim();
  if (!raw) return { phoneDial: "+1", phoneNational: "" };

  const sorted = [...new Set(dialCodes.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );

  if (raw.startsWith("+")) {
    for (const dial of sorted) {
      if (raw === dial) {
        return { phoneDial: dial, phoneNational: "" };
      }
      // "+1 555…", "+1-555…", "+1555…"
      if (
        raw.startsWith(`${dial} `) ||
        raw.startsWith(`${dial}-`) ||
        (raw.startsWith(dial) && raw.length > dial.length)
      ) {
        const rest = raw.slice(dial.length).replace(/^[\s\-()]+/, "");
        return {
          phoneDial: dial,
          phoneNational: nationalPhoneDigits(rest),
        };
      }
    }
    return {
      phoneDial: "+1",
      phoneNational: nationalPhoneDigits(raw),
    };
  }

  return { phoneDial: "+1", phoneNational: nationalPhoneDigits(raw) };
}

/** If the user pastes E.164 into the national field, re-split dial + digits. */
export function normalizeDialAndNational(
  phoneDial: string,
  phoneNational: string,
  dialCodes: readonly string[],
): { phoneDial: string; phoneNational: string } {
  const national = phoneNational.trim();
  if (national.startsWith("+")) {
    return splitShipToPhone(national, dialCodes);
  }
  const dial = phoneDial.trim() || "+1";
  if (
    national.startsWith(`${dial} `) ||
    national.startsWith(`${dial}-`) ||
    national.startsWith(dial)
  ) {
    const rest = national.slice(dial.length).replace(/^[\s\-()]+/, "");
    return { phoneDial: dial, phoneNational: nationalPhoneDigits(rest) };
  }
  return { phoneDial: dial, phoneNational: nationalPhoneDigits(national) };
}
