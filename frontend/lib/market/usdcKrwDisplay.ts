/**
 * Display-only KRW hint — not a live FX feed.
 * Override with `NEXT_PUBLIC_USD_KRW_RATE` if needed.
 */
const DEFAULT_USD_KRW_RATE = 1500;

export function usdToKrwRate(): number {
  const raw = process.env.NEXT_PUBLIC_USD_KRW_RATE;
  const n = raw != null ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_KRW_RATE;
}

/** Mobile listing line — e.g. `USDC $3,333.00` */
export function formatUsdcPricePrimary(usd: number): string {
  const amount = usd.toLocaleString("en-US", {
    minimumFractionDigits: usd >= 100 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `USDC $${amount}`;
}

/** Approximate KRW — e.g. `약 KRW 535,353.53` */
export function formatApproxKrwFromUsd(usd: number): string {
  const krw = usd * usdToKrwRate();
  const amount = krw.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `약 KRW ${amount}`;
}
