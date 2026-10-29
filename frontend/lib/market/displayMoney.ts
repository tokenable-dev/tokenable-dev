import type { DisplayCurrency } from "@/lib/i18n/preferences";
import { CURRENCY_OPTIONS } from "@/lib/i18n/preferences";

export type DisplayFx = {
  currency: DisplayCurrency;
  /** Foreign units per 1 USD. USD is 1. */
  rates: Partial<Record<DisplayCurrency, number>>;
  observationDate: string | null;
  fetchedAt: string | null;
  stale: boolean;
  /** Selected currency has no rate, so amounts stay in USD. */
  fallbackToUsd: boolean;
};

export const USD_DISPLAY_FX: DisplayFx = {
  currency: "USD",
  rates: { USD: 1 },
  observationDate: null,
  fetchedAt: null,
  stale: false,
  fallbackToUsd: false,
};

let snapshot: DisplayFx = USD_DISPLAY_FX;

export function getDisplayFx(): DisplayFx {
  return snapshot;
}

export function setDisplayFxSnapshot(next: DisplayFx): void {
  snapshot = next;
}

/** Price prefix. The header chip for KRW stays W; amounts use ₩. */
export function currencyNarrowSymbol(currency: DisplayCurrency): string {
  if (currency === "KRW") return "₩";
  return CURRENCY_OPTIONS.find((row) => row.code === currency)?.chip ?? currency;
}

export function convertUsdReference(
  usd: number,
  fx: DisplayFx,
): { amount: number; currency: DisplayCurrency; fallbackToUsd: boolean } {
  if (fx.currency === "USD") {
    return { amount: usd, currency: "USD", fallbackToUsd: false };
  }
  const rate = fx.rates[fx.currency];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return { amount: usd, currency: "USD", fallbackToUsd: true };
  }
  return { amount: usd * rate, currency: fx.currency, fallbackToUsd: false };
}

function formatGroupedAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/** `A$ 123`, not `$123 AUD`. A one-character symbol stays against the number (`$100`). */
export function formatDisplayAmount(amount: number, currency: DisplayCurrency): string {
  const symbol = currencyNarrowSymbol(currency);
  const body = formatGroupedAmount(amount);
  return symbol.length > 1 ? `${symbol} ${body}` : `${symbol}${body}`;
}

/** Missing rates stay labeled as USD (`$`). Every currency is a whole unit (`A$ 142`, not `A$ 142.36`). */
export function formatDisplayMoney(
  usd: number | null | undefined,
  fx: DisplayFx = getDisplayFx(),
): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  const converted = convertUsdReference(usd, fx);
  return formatDisplayAmount(converted.amount, converted.currency);
}

/**
 * Chart axis. Historical points are converted with the latest rate, not
 * the rate on the historical date.
 */
export function formatDisplayAxis(
  usd: number,
  fx: DisplayFx = getDisplayFx(),
): string {
  if (!Number.isFinite(usd)) return "—";
  const converted = convertUsdReference(usd, fx);
  const symbol = currencyNarrowSymbol(converted.currency);
  const n = Math.round(converted.amount);
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000
      ? `${Math.round(n / 1_000_000)}M`
      : abs >= 1000
        ? `${Math.round(n / 1000)}k`
        : String(n);
  return symbol.length > 1 ? `${symbol} ${body}` : `${symbol}${body}`;
}

/**
 * USDC payment, balance, or settlement shown as dollars.
 * 1 USDC = $1 on screen only. Not an FX conversion and not a market rate.
 */
export function formatUsdcAmount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n);
  const body = Math.abs(rounded).toLocaleString("en-US");
  return rounded < 0 ? `-$${body}` : `$${body}`;
}

/** Compact money for narrow mobile cells — `$950`, `$12.3K`, `$2.29M`, `$1.2B`. */
export function formatDisplayMoneyCompact(
  usd: number | null | undefined,
  fx: DisplayFx = getDisplayFx(),
): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  const converted = convertUsdReference(usd, fx);
  const abs = Math.abs(converted.amount);
  const units: [number, string][] = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  const unit = units.find(([v]) => abs >= v);
  if (!unit) return formatDisplayAmount(converted.amount, converted.currency);
  const scaled = converted.amount / unit[0];
  const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  const body = `${Number(scaled.toFixed(digits))}${unit[1]}`;
  const symbol = currencyNarrowSymbol(converted.currency);
  return symbol.length > 1 ? `${symbol} ${body}` : `${symbol}${body}`;
}
