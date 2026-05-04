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
 * Returns true only when the backend has marked the preview price as reliable.
 * - `priceReliability === 'high'` means backend sales threshold was met.
 * - `sales30d >= EXTERNAL_PRICE_MIN_SALES_30D` is a frontend double-check to
 *   catch cases where the cached backend response pre-dates a threshold change.
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
 * Applies a unified reliability gate so all callers (portfolio, token detail,
 * collection detail) show "—" for the same cards.  The gate requires:
 *   - backend `priceReliability === 'high'` (sales threshold met server-side)
 *   - `sales30d >= EXTERNAL_PRICE_MIN_SALES_30D` (frontend double-check)
 * `gradePrices` is only used when the preview itself is trusted, because both
 * originate from the same Cardhedger data pipeline.
 */
export function resolveExternalMarketUsd(params: {
  marketPreview: CollectionMarketPreview | null | undefined;
  gradePrices: CollectionGradePrices | null | undefined;
  gradeScore: number | null | undefined;
  /** When set, picks PSA_10 history tier for spot (same as chart). */
  components?: Record<string, unknown> | null;
}): ResolvedExternalMarketUsd {
  const trusted = isPreviewPriceReliable(params.marketPreview);
  const tier = marketHistoryTierFromComponents(params.components ?? null);
  const poke = catalogSpotUsdFromMarketPreview(
    trusted ? params.marketPreview : null,
    tier,
  );
  if (poke != null) {
    return {
      usd: poke,
      source: "cardhedger",
      marketMatchConfidence: params.marketPreview?.matchConfidence,
    };
  }
  const strip = representativeGradeUsd(
    trusted ? params.gradePrices : null,
    params.gradeScore,
  );
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
