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

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
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
 */
export function resolveExternalMarketUsd(params: {
  marketPreview: CollectionMarketPreview | null | undefined;
  gradePrices: CollectionGradePrices | null | undefined;
  gradeScore: number | null | undefined;
  /** When set, picks PSA_10 history tier for spot (same as chart). */
  components?: Record<string, unknown> | null;
}): ResolvedExternalMarketUsd {
  const tier = marketHistoryTierFromComponents(params.components ?? null);
  const poke = catalogSpotUsdFromMarketPreview(params.marketPreview, tier);
  if (poke != null) {
    return {
      usd: poke,
      source: "cardhedger",
      marketMatchConfidence: params.marketPreview?.matchConfidence,
    };
  }
  const strip = representativeGradeUsd(params.gradePrices, params.gradeScore);
  if (strip != null) return { usd: strip, source: "cardhedger" };
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
