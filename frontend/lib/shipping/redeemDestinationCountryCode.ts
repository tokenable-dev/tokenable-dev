import type { ShippingCountry } from "@/lib/core/api/shipping-addresses";

/**
 * Client-provided ISO-2 for FedEx Rate (backend does not infer from phone).
 * us/ca map directly; intl uses the selected dial's country when known.
 */
const DIAL_TO_ISO2: Record<string, string> = {
  "+1": "US",
  "+44": "GB",
  "+81": "JP",
  "+82": "KR",
  "+86": "CN",
  "+852": "HK",
  "+886": "TW",
  "+65": "SG",
  "+61": "AU",
  "+64": "NZ",
  "+49": "DE",
  "+33": "FR",
  "+39": "IT",
  "+34": "ES",
  "+31": "NL",
  "+41": "CH",
  "+46": "SE",
  "+47": "NO",
  "+45": "DK",
  "+358": "FI",
  "+351": "PT",
  "+353": "IE",
  "+32": "BE",
  "+43": "AT",
  "+48": "PL",
  "+420": "CZ",
  "+36": "HU",
  "+30": "GR",
  "+90": "TR",
  "+7": "RU",
  "+966": "SA",
  "+971": "AE",
  "+972": "IL",
  "+91": "IN",
  "+62": "ID",
  "+66": "TH",
  "+84": "VN",
  "+63": "PH",
  "+60": "MY",
  "+52": "MX",
  "+55": "BR",
  "+54": "AR",
  "+56": "CL",
  "+57": "CO",
  "+27": "ZA",
};

/** ISO-2 passed as shipTo.countryCode for Partner FedEx quotes. */
export function redeemDestinationCountryCode(input: {
  country: ShippingCountry;
  phoneDial?: string;
}): string {
  if (input.country === "us") return "US";
  if (input.country === "ca") return "CA";
  const dial = (input.phoneDial ?? "").trim();
  const iso = DIAL_TO_ISO2[dial];
  if (!iso) {
    throw new Error(
      "Select a phone country code so we can determine the shipping destination country",
    );
  }
  // +1 shared by US/CA — intl bucket with +1 is ambiguous; default US.
  if (dial === "+1") return "US";
  return iso;
}
