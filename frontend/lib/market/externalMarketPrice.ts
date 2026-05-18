import type { CollectionGradePrices, CollectionMarketPreview, CollectionUsdPoint } from "@/lib/core";
import {
  catalogSpotUsdFromMarketPreview,
} from "@/lib/market";
import { marketHistoryTierFromComponents } from "@/lib/market";

/** Catalog reference for marketplace/portfolio (currently Cardhedger-backed). */
export type ExternalMarketPriceSource = "cardhedger";

export type ResolvedExternalMarketUsd = {
  usd: number | null;
  source: ExternalMarketPriceSource | null;
  /** strict verified id vs relaxed approximate catalog row */
  marketMatchConfidence?: "verified" | "approximate";
};

/**
 * Minimum 30-day sales required before trusting a Cardhedger preview price.
 * Must match CARDHEDGER_MIN_RELIABLE_SALES_30D / CARDHEDGER_MIN_VERIFIED_SALES_30D on the backend.
 * NOTE: Cardhedger's `sales30d` is total-card (all grades), not PSA-10-specific.
 * A conservative threshold prevents stale catalog prices on thinly-traded rare cards.
 */
export const EXTERNAL_PRICE_MIN_SALES_30D = 5;

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Strict liquidity gate: high reliability + minimum 30d sales (portfolio risk / badges).
 * For displaying spot USD we often still show {@link resolveExternalMarketUsd} even when this is false.
 */
export function isPreviewPriceReliable(
  preview: CollectionMarketPreview | null | undefined,
): boolean {
  if (!preview?.card) return false;
  return (
    preview.card.priceReliability === "high" &&
    (preview.card.sales30d ?? 0) >= EXTERNAL_PRICE_MIN_SALES_30D
  );
}

/** `gradePrices` strip from the collection market bundle (PSA slots carry the same reference feed). */
export function representativeGradeUsd(
  gradePrices: CollectionGradePrices | null | undefined,
  gradeScore: number | null | undefined,
): number | null {
  if (!gradePrices || gradeScore == null || !Number.isFinite(gradeScore)) return null;
  const r = Math.round(gradeScore);
  if (r !== 10) return null;
  return finitePositive(gradePrices.psa10);
}

/**
 * Cardhedger catalog spot (tier-aware), then bundle `gradePrices`.
 *
 * Uses the best reference from `marketPreview` whenever matched (including thin-market / low
 * `priceReliability`), then falls back to `gradePrices` for the slab tier.
 */
export function resolveExternalMarketUsd(params: {
  marketPreview: CollectionMarketPreview | null | undefined;
  gradePrices: CollectionGradePrices | null | undefined;
  gradeScore: number | null | undefined;
  /** When set, picks PSA_10 history tier for spot (same as chart). */
  components?: Record<string, unknown> | null;
}): ResolvedExternalMarketUsd {
  const tier = marketHistoryTierFromComponents(params.components ?? null);
  const preview =
    params.marketPreview?.matched && params.marketPreview.card
      ? params.marketPreview
      : null;
  const poke = catalogSpotUsdFromMarketPreview(preview, tier);
  if (poke != null) {
    return {
      usd: poke,
      source: "cardhedger",
      marketMatchConfidence: params.marketPreview?.matchConfidence,
    };
  }
  const strip = representativeGradeUsd(params.gradePrices, params.gradeScore);
  if (strip != null) {
    return { usd: strip, source: "cardhedger" };
  }
  return { usd: null, source: null };
}

/** First → last point % change (e.g. ~1y PokeTrace daily series). */
export function percentChangeFromUsdPoints(
  points: CollectionUsdPoint[] | null | undefined,
): number | null {
  const arr = points ?? [];
  if (arr.length < 2) return null;
  const a = arr[0].v;
  const b = arr[arr.length - 1].v;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

const SEC_24H = 86400;

/**
 * Latest observation vs linearly interpolated value at (latest.t − 24h) on the same series.
 * Matches backend `percentChangeReferenceOver24h` in `collection-market.util.ts`
 * (markets list / `market-series` bundle `marketChangePct`).
 *
 * Unlike {@link percentChangeUsdSinceCutoff} anchored to wall-clock “now”, this still works when the feed’s
 * newest point is older than 24h (stale Cardhedger ticks).
 */
export function percentChangeReferenceOver24h(
  points: CollectionUsdPoint[] | null | undefined,
): number | null {
  const cleaned = (points ?? []).filter(
    (p) =>
      Number.isFinite(p.t) &&
      Number.isFinite(p.v) &&
      p.v > 0,
  );
  if (cleaned.length < 2) return null;
  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const end = sorted[sorted.length - 1]!;
  const targetT = end.t - SEC_24H;
  if (targetT < sorted[0]!.t) return null;

  let i0 = -1;
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k]!.t <= targetT) i0 = k;
    else break;
  }
  if (i0 < 0) return null;

  let refV: number;
  const a = sorted[i0]!;
  if (a.t === targetT) {
    refV = a.v;
  } else if (i0 + 1 < sorted.length) {
    const b = sorted[i0 + 1]!;
    if (b.t <= targetT) return null;
    const dt = b.t - a.t;
    if (dt <= 0) return null;
    const w = (targetT - a.t) / dt;
    refV = a.v + (b.v - a.v) * w;
  } else {
    refV = a.v;
  }

  if (
    !Number.isFinite(refV) ||
    refV <= 0 ||
    !Number.isFinite(end.v) ||
    end.v <= 0
  ) {
    return null;
  }
  return ((end.v - refV) / refV) * 100;
}

/**
 * % change from the last sample at or before `cutoffSec` to the latest sample in `points`
 * (reference external / chart USD series). Returns null if there is no baseline older than the latest point.
 */
export function percentChangeUsdSinceCutoff(
  points: CollectionUsdPoint[] | null | undefined,
  cutoffSec: number,
): number | null {
  const sorted = [...(points ?? [])]
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t - b.t);
  if (sorted.length < 2) return null;
  const last = sorted[sorted.length - 1];
  let baseIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].t <= cutoffSec) baseIdx = i;
    else break;
  }
  if (baseIdx < 0) return null;
  if (baseIdx >= sorted.length - 1) return null;
  const a = sorted[baseIdx].v;
  const b = last.v;
  if (!(a > 0) || !Number.isFinite(b)) return null;
  return ((b - a) / a) * 100;
}

/** Population CV% on a USD time series (e.g. PokeTrace NM daily closes). */
export function coefficientOfVariationPctFromUsdSeries(
  points: CollectionUsdPoint[] | null | undefined,
): number | null {
  const vals = (points ?? [])
    .map((p) => p.v)
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (vals.length < 3) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (!(mean > 0)) return null;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const cv = (Math.sqrt(variance) / mean) * 100;
  if (!Number.isFinite(cv)) return null;
  return Math.min(999, Math.round(cv * 10) / 10);
}
