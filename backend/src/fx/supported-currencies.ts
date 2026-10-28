/** Display currencies verified on Frankfurter's ECB provider (base USD). */
export const SUPPORTED_DISPLAY_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'KRW',
  'JPY',
  'SGD',
  'CAD',
  'AUD',
  'CHF',
  'HKD',
  'CNY',
  'IDR',
  'MYR',
  'PHP',
  'VND',
  'THB',
] as const;

export type SupportedDisplayCurrency =
  (typeof SUPPORTED_DISPLAY_CURRENCIES)[number];

/**
 * Quotes requested from ECB. USD is the base and is not fetched.
 * VND is a display currency, but ECB does not publish it.
 */
export const ECB_QUOTE_CURRENCIES = SUPPORTED_DISPLAY_CURRENCIES.filter(
  (code) => code !== 'USD' && code !== 'VND',
);

export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'ja', 'zh-TW'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedDisplayCurrency(
  value: string,
): value is SupportedDisplayCurrency {
  return (SUPPORTED_DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** `zh-cn` and `ZH-TW` become the stored code. `ko`, `zh`, and `en-US` do not. */
export function canonicalizeLocale(raw: string): SupportedLocale | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  return SUPPORTED_LOCALES.find((code) => code.toLowerCase() === value) ?? null;
}
