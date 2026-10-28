import { formatDisplayMoney, formatUsdcAmount, getDisplayFx } from "@/lib/market/displayMoney";

/**
 * Display-only KRW hint. Uses the loaded ECB rate.
 * Does not invent a rate when KRW is missing.
 */
export function formatApproxKrwFromUsd(usd: number): string {
  const fx = getDisplayFx();
  const rate = fx.rates.KRW;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return formatDisplayMoney(usd, { ...fx, currency: "USD", fallbackToUsd: true });
  }
  return formatDisplayMoney(usd, {
    ...fx,
    currency: "KRW",
    rates: { ...fx.rates, KRW: rate },
    fallbackToUsd: false,
  });
}

/** USDC settlement line, shown as `$` at 1:1. Not converted. */
export function formatUsdcPricePrimary(usd: number): string {
  return formatUsdcAmount(usd);
}
