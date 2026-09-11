import type { ShippingCountry } from "@/lib/core/api/shipping-addresses";
import { phoneDialLensFor } from "@/lib/shipping/phoneDialOptions";
import { redeemDestinationCountryCode } from "@/lib/shipping/redeemDestinationCountryCode";

export type ShipToFieldKey =
  | "name"
  | "line1"
  | "city"
  | "region"
  | "postal"
  | "phone"
  | "country";

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

/**
 * NANP numbers have no domestic trunk prefix, so a leading `0` there is a typo
 * rather than slack we should strip.
 */
const TRUNK_PREFIX_EXEMPT_DIALS = new Set(["+1"]);

/**
 * Ways a user may have typed the same national number: with the international
 * access code (`0082…`), with the dial code repeated (`8210…`), or with the
 * domestic trunk prefix (`010…`). Ordered most-specific-last.
 */
function phoneDigitCandidates(digits: string, phoneDial: string): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };

  push(digits);
  if (digits.startsWith("00")) push(digits.slice(2));

  const dialDigits = phoneDial.replace(/[^\d]/g, "");
  if (dialDigits) {
    for (const value of [...out]) {
      if (value.startsWith(dialDigits)) push(value.slice(dialDigits.length));
    }
  }

  if (!TRUNK_PREFIX_EXEMPT_DIALS.has(phoneDial)) {
    for (const value of [...out]) {
      if (value.startsWith("0")) push(value.slice(1));
    }
  }

  return out;
}

/**
 * Strip the trunk prefix / duplicated dial code so the stored E.164 number is
 * dial + national digits only (e.g. `+82 01012345678` → `+82 1012345678`).
 */
export function normalizeNationalPhoneDigits(
  phoneDial: string,
  national: string,
  lensCsv: string,
): string {
  const digits = nationalPhoneDigits(national);
  if (!digits) return "";
  const lens = lensCsv || "7,15";
  const valid = phoneDigitCandidates(digits, phoneDial).filter((c) =>
    phoneLengthOk(c, lens),
  );
  if (valid.length === 0) return digits;
  // Both the trunk-prefixed and stripped forms can be length-valid (e.g. +49
  // allows 10 or 11). A national significant number never keeps the trunk 0.
  return valid.find((c) => !c.startsWith("0")) ?? valid[0]!;
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
  const phoneAccepted =
    digits.length > 0 &&
    phoneDigitCandidates(digits, input.phoneDial).some((c) =>
      phoneLengthOk(c, lens),
    );
  if (!phoneAccepted) {
    const parts = lens.split(",").map((s) => s.trim()).filter(Boolean);
    const lenHint =
      parts.length === 1
        ? `${parts[0]}-digit`
        : `${parts.join(" or ")}-digit`;
    const dial = input.phoneDial ? `${input.phoneDial} ` : "";
    errors.phone = `Enter a valid ${lenHint} number for ${dial || "the selected country"}`;
  }

  const UNDELIVERABLE: Record<string, string> = {
    TH: "Thailand",
    RU: "Russia",
    BY: "Belarus",
  };
  try {
    const iso = redeemDestinationCountryCode({
      country: input.country,
      phoneDial: input.phoneDial,
    });
    const blocked = UNDELIVERABLE[iso];
    if (blocked) {
      errors.country = `We can’t ship an insured vault package to ${blocked}`;
    }
  } catch {
    /* dial/country incomplete — other field errors cover it */
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
    "country",
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
  return `${d} ${normalizeNationalPhoneDigits(d, n, phoneDialLensFor(d))}`.trim();
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
