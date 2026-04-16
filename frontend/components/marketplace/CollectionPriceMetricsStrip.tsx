"use client";

/**
 * Price chart 상단 4칸 메트릭 — Current Price / Price Change / Volatility / Market Cap
 */

function InfoHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-zinc-600 text-[9px] font-bold text-zinc-500"
      title={text}
      aria-label={text}
    >
      i
    </span>
  );
}

function metricVolatilityFromPrices(usdValues: number[]): number | null {
  const vals = usdValues.filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (mean <= 0) return null;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const cv = (Math.sqrt(variance) / mean) * 100;
  if (!Number.isFinite(cv)) return null;
  return Math.min(999, Math.round(cv * 10) / 10);
}

export interface CollectionPriceMetricsStripProps {
  /** 가장 최근 플랫폼(온체인) 체결가 USDC — 없으면 N/A */
  lastPlatformTradeUsd: number | null;
  priceChangePct: number | null;
  /** 플랫폼 체결 시계열 — 변동성 근사에 사용 */
  platformPriceSamples: number[];
  /** bid–ask 스프레드 % (시계열 부족 시 폴백) */
  bookSpreadPct: number | null;
  marketCapUsd: number | null;
  formatMarketCap: (usd: number | null) => string;
}

export function CollectionPriceMetricsStrip({
  lastPlatformTradeUsd,
  priceChangePct,
  platformPriceSamples,
  bookSpreadPct,
  marketCapUsd,
  formatMarketCap,
}: CollectionPriceMetricsStripProps) {
  const volFromTrades = metricVolatilityFromPrices(platformPriceSamples);
  const volatilityPct = volFromTrades ?? bookSpreadPct;

  const change = priceChangePct;
  const changeUp = change != null && change > 0;
  const changeDown = change != null && change < 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 w-full min-w-0 mb-4">
      <div
        className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        title="Most recent trade on this platform (USDC)"
      >
        <p className="text-[11px] font-medium text-zinc-500">Current Price</p>
        <p
          className={`mt-2 text-2xl font-bold tabular-nums sm:text-[1.65rem] ${
            lastPlatformTradeUsd != null && Number.isFinite(lastPlatformTradeUsd)
              ? "text-emerald-400"
              : "text-zinc-500"
          }`}
        >
          {lastPlatformTradeUsd != null && Number.isFinite(lastPlatformTradeUsd)
            ? `$${lastPlatformTradeUsd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "N/A"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-500">Price Change</p>
          <InfoHint text="Change from the previous on-platform trade to the latest (USDC)." />
        </div>
        <p
          className={`mt-2 flex items-baseline gap-1.5 text-2xl font-bold tabular-nums sm:text-[1.65rem] ${
            change == null || !Number.isFinite(change)
              ? "text-zinc-500"
              : changeUp
                ? "text-emerald-400"
                : changeDown
                  ? "text-rose-400"
                  : "text-zinc-100"
          }`}
        >
          {change != null && Number.isFinite(change) ? (
            <>
              <span>
                {change > 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
              <span className="text-lg" aria-hidden>
                {changeUp ? "↗" : changeDown ? "↘" : ""}
              </span>
            </>
          ) : (
            "N/A"
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[11px] font-medium text-zinc-500">Volatility</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white sm:text-[1.65rem]">
          {volatilityPct != null && Number.isFinite(volatilityPct)
            ? `${volatilityPct.toFixed(0)}%`
            : "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[11px] font-medium text-zinc-500">Market Cap</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white sm:text-[1.65rem]">
          {formatMarketCap(marketCapUsd)}
        </p>
      </div>
    </div>
  );
}
