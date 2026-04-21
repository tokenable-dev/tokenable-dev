"use client";

import type { CollectionMarketStats } from "@/lib/api";
import type { ExternalMarketPriceSource } from "@/lib/externalMarketPrice";
import {
  formatLiquidityDepthLabel,
  formatUsdCompact,
  NO_EXTERNAL_PRICE,
} from "@/lib/collectionMarketPricing";

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

function sourceSubtitle(
  src: ExternalMarketPriceSource | null | undefined,
  poketraceMatchConfidence?: "verified" | "approximate" | null,
): string {
  if (src === "poketrace") {
    if (poketraceMatchConfidence === "approximate") {
      return "PokéTrace Near Mint · approximate catalog match";
    }
    return "PokéTrace Near Mint";
  }
  if (src === "justtcg") return "JustTCG grade strip (fallback)";
  return "";
}

export interface CollectionPriceMetricsStripProps {
  /** Primary spot: PokéTrace NM → JustTCG; never listing-pool median. */
  externalMarketUsd?: number | null;
  externalPriceSource?: ExternalMarketPriceSource | null;
  /** When external price is from PokéTrace, mirrors preview `matchConfidence`. */
  externalPoketraceMatchConfidence?: "verified" | "approximate" | null;
  externalPriceLoading?: boolean;
  /** CV% from PokéTrace NM history when available. */
  externalVolatilityCvPct?: number | null;
  /** Listing pool — liquidity hint only (optional one-liner under market price). */
  marketStats?: CollectionMarketStats | null;
  marketStatsLoading?: boolean;
  /** 가장 최근 플랫폼(온체인) 체결가 USDC — execution context */
  lastPlatformTradeUsd: number | null;
  priceChangePct: number | null;
  /** 플랫폼 체결 시계열 — recent-trade change & fallback volatility */
  platformPriceSamples: number[];
  bookSpreadPct: number | null;
  marketCapUsd: number | null;
  formatMarketCap: (usd: number | null) => string;
}

export function CollectionPriceMetricsStrip({
  externalMarketUsd = null,
  externalPriceSource = null,
  externalPoketraceMatchConfidence = null,
  externalPriceLoading = false,
  externalVolatilityCvPct = null,
  marketStats = null,
  marketStatsLoading = false,
  lastPlatformTradeUsd,
  priceChangePct,
  platformPriceSamples,
  bookSpreadPct,
  marketCapUsd,
  formatMarketCap,
}: CollectionPriceMetricsStripProps) {
  const volFromTrades = metricVolatilityFromPrices(platformPriceSamples);
  const volatilityPct =
    externalVolatilityCvPct != null && Number.isFinite(externalVolatilityCvPct)
      ? externalVolatilityCvPct
      : volFromTrades ?? bookSpreadPct;

  const change = priceChangePct;
  const changeUp = change != null && change > 0;
  const changeDown = change != null && change < 0;

  const showExternalPrimary =
    externalMarketUsd != null &&
    Number.isFinite(externalMarketUsd) &&
    externalMarketUsd > 0;

  const liquidityLine = marketStatsLoading
    ? "Loading on-platform depth…"
    : formatLiquidityDepthLabel(marketStats ?? undefined);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 w-full min-w-0 mb-4">
      <div
        className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        title="External Near Mint estimate — PokéTrace primary, JustTCG fallback. Not derived from this site’s listing pool."
      >
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-500">Market price</p>
          <InfoHint text="PokéTrace NM blended spot when matched; otherwise JustTCG grade strip. Internal listing stats are never used as this number." />
        </div>
        {externalPriceLoading && !showExternalPrimary ? (
          <div className="mt-2 h-9 w-28 animate-pulse rounded-md bg-zinc-800/70" />
        ) : showExternalPrimary ? (
          <>
            <p className="mt-2 text-2xl font-bold tabular-nums text-teal-400 sm:text-[1.65rem]">
              {formatUsdCompact(externalMarketUsd)}
            </p>
            {externalPriceSource ? (
              <p className="mt-1 text-[10px] leading-snug text-zinc-500 tabular-nums">
                {sourceSubtitle(externalPriceSource, externalPoketraceMatchConfidence)}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-2 text-lg font-semibold leading-snug text-zinc-500">{NO_EXTERNAL_PRICE}</p>
            <p className="mt-1 text-[9px] text-zinc-600">Configure PokéTrace match or JustTCG data.</p>
          </>
        )}
        {liquidityLine && (marketStats != null || marketStatsLoading) ? (
          <p className="mt-2 border-t border-zinc-800/80 pt-2 text-[9px] leading-snug text-zinc-600">
            Liquidity: {liquidityLine}
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-500">Recent trade</p>
          <InfoHint text="Latest on-platform trade (USDC) — execution, not the external catalog price." />
        </div>
        <p
          className={`mt-2 text-2xl font-bold tabular-nums sm:text-[1.65rem] ${
            lastPlatformTradeUsd != null && Number.isFinite(lastPlatformTradeUsd)
              ? "text-fuchsia-400/95"
              : "text-zinc-500"
          }`}
        >
          {lastPlatformTradeUsd != null && Number.isFinite(lastPlatformTradeUsd)
            ? `$${lastPlatformTradeUsd.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            : "—"}
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <p className="text-[10px] font-medium text-zinc-600">Δ vs prior trade</p>
        </div>
        <p
          className={`mt-0.5 flex items-baseline gap-1.5 text-lg font-bold tabular-nums ${
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
              <span className="text-base" aria-hidden>
                {changeUp ? "↗" : changeDown ? "↘" : ""}
              </span>
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-medium text-zinc-500">NM volatility</p>
          <InfoHint text="Coefficient of variation on PokéTrace NM daily history when available; otherwise approximated from on-platform trades or bid/ask spread." />
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white sm:text-[1.65rem]">
          {volatilityPct != null && Number.isFinite(volatilityPct)
            ? `${volatilityPct.toFixed(0)}%`
            : "—"}
        </p>
        <p className="mt-1 text-[9px] text-zinc-600">
          {externalVolatilityCvPct != null ? "From PokéTrace NM history" : "External or execution proxy"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <p className="text-[11px] font-medium text-zinc-500">Market cap (est.)</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-white sm:text-[1.65rem]">
          {formatMarketCap(marketCapUsd)}
        </p>
      </div>
    </div>
  );
}
