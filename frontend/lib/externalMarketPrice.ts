import type { CollectionGradePrices, CollectionPoketracePreview, CollectionUsdPoint } from "@/lib/api";
import { nmSpotUsdFromPoketracePreview } from "@/lib/gradedCardMarketCap";

export type ExternalMarketPriceSource = "poketrace" | "justtcg";

export type ResolvedExternalMarketUsd = {
  usd: number | null;
  source: ExternalMarketPriceSource | null;
  /** When source is PokéTrace, indicates strict verified id vs relaxed approximate catalog row */
  poketraceMatchConfidence?: "verified" | "approximate";
};

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** JustTCG grade strip — fallback unit when PokeTrace NM spot is unavailable. */
export function justtcgRepresentativeUsd(
  gradePrices: CollectionGradePrices | null | undefined,
  gradeScore: number | null | undefined,
): number | null {
  if (!gradePrices || gradeScore == null || !Number.isFinite(gradeScore)) return null;
  const r = Math.round(gradeScore);
  if (r >= 10) return finitePositive(gradePrices.psa10);
  if (r === 9) return finitePositive(gradePrices.psa9);
  return finitePositive(gradePrices.raw);
}

/**
 * Product order: PokeTrace NM (primary) → JustTCG grade strip. Never listing-pool stats.
 */
export function resolveExternalMarketUsd(params: {
  poketracePreview: CollectionPoketracePreview | null | undefined;
  gradePrices: CollectionGradePrices | null | undefined;
  gradeScore: number | null | undefined;
}): ResolvedExternalMarketUsd {
  const poke = nmSpotUsdFromPoketracePreview(params.poketracePreview);
  if (poke != null) {
    return {
      usd: poke,
      source: "poketrace",
      poketraceMatchConfidence: params.poketracePreview?.matchConfidence,
    };
  }
  const jt = justtcgRepresentativeUsd(params.gradePrices, params.gradeScore);
  if (jt != null) return { usd: jt, source: "justtcg" };
  return { usd: null, source: null };
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
