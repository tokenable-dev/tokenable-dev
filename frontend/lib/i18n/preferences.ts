/**
 * Display currencies. ECB publishes every code except USD and VND.
 * VND comes from Frankfurter BNM. Keep in step with
 * `backend/src/fx/supported-currencies.ts`.
 */
export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "KRW",
  "HKD",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "IDR",
  "MYR",
  "PHP",
  "VND",
  "THB",
] as const;

/** Chip glyphs match the currency picker. Names are the English catalog labels. */
export const CURRENCY_OPTIONS: {
  code: DisplayCurrency;
  name: string;
  chip: string;
}[] = [
  { code: "USD", name: "US Dollar", chip: "$" },
  { code: "EUR", name: "Euro", chip: "€" },
  { code: "GBP", name: "British Pound", chip: "£" },
  { code: "JPY", name: "Japanese Yen", chip: "¥" },
  { code: "KRW", name: "South Korean Won", chip: "W" },
  { code: "HKD", name: "Hong Kong Dollar", chip: "HK$" },
  { code: "SGD", name: "Singapore Dollar", chip: "S$" },
  { code: "AUD", name: "Australian Dollar", chip: "A$" },
  { code: "CAD", name: "Canadian Dollar", chip: "C$" },
  { code: "CHF", name: "Swiss Franc", chip: "CHF" },
  { code: "IDR", name: "Indonesian Rupiah", chip: "Rp" },
  { code: "MYR", name: "Malaysian Ringgit", chip: "RM" },
  { code: "PHP", name: "Philippine Peso", chip: "₱" },
  { code: "VND", name: "Vietnamese Dong", chip: "₫" },
  { code: "THB", name: "Thai Baht", chip: "฿" },
];

export type DisplayCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Customer locales. Add a language by shipping `messages/{code}.json` and one row here.
 * Flags are display-only. `code` is the identifier.
 */
export const SUPPORTED_LOCALES = ["en", "zh-CN", "ja", "zh-TW"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_OPTIONS: {
  code: AppLocale;
  /** Endonym. Stays in this language so the picker is recognizable in any UI locale. */
  name: string;
  /** Header chip. Not a locale identifier. */
  short: string;
  flag: string;
}[] = [
  { code: "en", name: "English", short: "EN", flag: "🇺🇸" },
  { code: "zh-CN", name: "简体中文", short: "简中", flag: "🇨🇳" },
  { code: "ja", name: "日本語", short: "JA", flag: "🇯🇵" },
  { code: "zh-TW", name: "繁體中文", short: "繁中", flag: "🇹🇼" },
];

export const LOCALE_COOKIE = "tk_locale";
export const CURRENCY_COOKIE = "tk_currency";

export function resolveLocale(raw: string | null | undefined): AppLocale {
  const value = raw?.trim().toLowerCase();
  if (!value) return "en";
  const match = SUPPORTED_LOCALES.find((code) => code.toLowerCase() === value);
  return match ?? "en";
}

/**
 * Saved profile wins for a signed-in user. A guest cookie is used only when
 * the profile has no locale. Invalid values fall through to English.
 */
export function resolveAppLocale(input: {
  authenticated: boolean;
  profile: string | null | undefined;
  cookie: string | null | undefined;
}): AppLocale {
  const profile = input.profile?.trim() ? resolveLocale(input.profile) : null;
  const profileValid =
    input.profile?.trim() &&
    SUPPORTED_LOCALES.some((code) => code.toLowerCase() === input.profile!.trim().toLowerCase());
  const cookie = resolveLocale(input.cookie);
  const cookieValid =
    !!input.cookie?.trim() &&
    SUPPORTED_LOCALES.some((code) => code.toLowerCase() === input.cookie!.trim().toLowerCase());
  if (input.authenticated && profileValid && profile) return profile;
  if (cookieValid) return cookie;
  return "en";
}

export function resolveCurrency(raw: string | null | undefined): DisplayCurrency | null {
  const value = raw?.trim().toUpperCase();
  if (!value) return null;
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
    ? (value as DisplayCurrency)
    : null;
}

/**
 * Saved profile wins for a signed-in user. A guest cookie is used only when
 * the profile has no currency. Malformed values fall through to USD.
 * A guest cookie never overwrites a saved profile.
 */
export function resolveDisplayCurrency(input: {
  authenticated: boolean;
  profile: string | null | undefined;
  cookie: string | null | undefined;
}): DisplayCurrency {
  const profile = resolveCurrency(input.profile);
  const cookie = resolveCurrency(input.cookie);
  if (input.authenticated && profile) return profile;
  if (cookie) return cookie;
  return "USD";
}
