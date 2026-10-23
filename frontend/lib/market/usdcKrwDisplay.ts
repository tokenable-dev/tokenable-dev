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

/** Mobile listing line — e.g. `USDC $3,333` */
export function formatUsdcPricePrimary(usd: number): string {
  const amount = Math.round(usd).toLocaleString("en-US");
  return `USDC $${amount}`;
}

/** Approximate KRW — e.g. `약 KRW 535,354` */
export function formatApproxKrwFromUsd(usd: number): string {
  const krw = Math.round(usd * usdToKrwRate());
  return `약 KRW ${krw.toLocaleString("en-US")}`;
}
