import { BadRequestException } from '@nestjs/common';

const REJECTED_ISO = new Set(['XX', 'ZZ']);

/**
 * Strict ISO-3166 alpha-2 for FedEx (and Origin). Never invents a country.
 */
export function requireIso2CountryCode(
  raw: string | null | undefined,
  fieldLabel: string,
): string {
  const c = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c) || REJECTED_ISO.has(c)) {
    throw new BadRequestException(
      `${fieldLabel} must be a valid ISO-3166 alpha-2 country code (got "${raw ?? ''}")`,
    );
  }
  return c;
}

/**
 * Resolve FedEx destination country from ship-to.
 * - Prefer explicit `countryCode` (ISO-2).
 * - Legacy fee bucket on `country`: us→US, ca→CA only.
 * - Never uses phone dialling codes or "XX".
 */
export function resolveShipToDestinationIso2(input: {
  /** Fee bucket (`us`|`ca`|`intl`) or already-ISO-2. */
  country: string;
  /** Preferred ISO-2 for Rate API. Required when country is `intl`. */
  countryCode?: string | null;
}): string {
  if (input.countryCode != null && String(input.countryCode).trim() !== '') {
    return requireIso2CountryCode(input.countryCode, 'shipTo.countryCode');
  }

  const raw = String(input.country ?? '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'us') return 'US';
  if (lower === 'ca') return 'CA';
  if (lower === 'intl') {
    throw new BadRequestException(
      'shipTo.countryCode (ISO-3166 alpha-2) is required for international Partner shipping quotes',
    );
  }

  return requireIso2CountryCode(raw, 'shipTo.country');
}
