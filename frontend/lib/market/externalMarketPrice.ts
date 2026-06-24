import type { CollectionGradePrices, CollectionMarketPreview, CollectionUsdPoint } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  catalogSpotUsdFromMarketPreview,
} from "@/lib/market";
import { marketHistoryTierFromComponents } from "@/lib/market";
import { isAuthQualifierGradeScore } from "@/lib/market/priceTier";
import {
  MARKET_PRICE_CHANGE_LAG_SEC,
  referenceHistoryCoversFullYear,
  type ReferencePercentChangeResult,
} from "@/lib/market/priceChangePeriod";

/** Catalog reference for marketplace/portfolio (Cardhedger or PSA Estimate fallback). */
export type ExternalMarketPriceSource =
  | "cardhedger"
  | "cardhedger_fmv"
  | "cardhedger_estimate"
  | "cardhedger_comps"
  | "psa_estimate";

export function externalMarketPriceSourceLabel(
  source: ExternalMarketPriceSource | null | undefined,
): string | null {
  if (source === "psa_estimate") return "PSA Estimate";
  if (source === "cardhedger_fmv") return "Cardhedger FMV";
  if (source === "cardhedger_estimate") return "Cardhedger Estimate";
  if (source === "cardhedger_comps") return "Cardhedger Comps";
  return null;
}

function priceSourceFromPreview(
  preview: CollectionMarketPreview | null | undefined,
): ExternalMarketPriceSource | null {
  const raw = preview?.card?.priceSource;
  if (raw === "cardhedger_fmv") return "cardhedger_fmv";
  if (raw === "cardhedger_estimate") return "cardhedger_estimate";
  if (raw === "cardhedger_comps") return "cardhedger_comps";
  return null;
}

export type ResolvedExternalMarketUsd = {
  usd: number | null;
  source: ExternalMarketPriceSource | null;
  /** strict verified id vs relaxed approximate catalog row */
  marketMatchConfidence?: "verified" | "approximate";
};

/**
 * Minimum 30-day sales required before trusting a Cardhedger preview price as "high reliability".
 * Must match CARDHEDGER_MIN_VERIFIED_SALES_30D on the backend (default 1).
 * NOTE: Cardhedger's `sales30d` is total-card (all grades), not PSA-10-specific.
 */
export const EXTERNAL_PRICE_MIN_SALES_30D = 1;

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

/** `gradePrices` strip from the collection market bundle — tier-aware (PSA 10 / 9 / raw). */
export function representativeGradeUsd(
  gradePrices: CollectionGradePrices | null | undefined,
  gradeScore: number | null | undefined,
  gradeScoreStr?: string | null,
): number | null {
  if (isAuthQualifierGradeScore(gradeScoreStr)) {
    return finitePositive(gradePrices?.psa10);
  }
  if (!gradePrices || gradeScore == null || !Number.isFinite(gradeScore)) return null;
  const r = Math.round(gradeScore);
  if (r >= 10) return finitePositive(gradePrices.psa10);
  if (r === 9) return finitePositive(gradePrices.psa9);
  return finitePositive(gradePrices.raw);
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
  components?: CollectionComponents | null;
  /** Materialized snapshot spot basis from market-series bundle. */
  spotPriceBasis?: string | null;
}): ResolvedExternalMarketUsd {
  const tier = marketHistoryTierFromComponents(params.components ?? null);
  const preview =
    params.marketPreview?.matched && params.marketPreview.card
      ? params.marketPreview
      : null;
  const catalogSpotUsd = catalogSpotUsdFromMarketPreview(preview, tier);
  if (catalogSpotUsd != null) {
    const explicitSource = priceSourceFromPreview(params.marketPreview);
    return {
      usd: catalogSpotUsd,
      source: explicitSource ?? "cardhedger",
      marketMatchConfidence: params.marketPreview?.matchConfidence,
    };
  }
  const strip = representativeGradeUsd(
    params.gradePrices,
    params.gradeScore,
    typeof params.components?.gradeScore === "string"
      ? params.components.gradeScore
      : null,
  );
  if (strip != null) {
    const compEstimate = finitePositive(params.components?.psaEstimateUsd);
    const isPsaEstimate =
      params.spotPriceBasis === "psa_estimate" ||
      (preview == null && compEstimate != null && Math.abs(compEstimate - strip) < 0.01);
    return {
      usd: strip,
      source: isPsaEstimate ? "psa_estimate" : "cardhedger",
    };
  }

  const compEstimate = finitePositive(params.components?.psaEstimateUsd);
  if (compEstimate != null) {
    return { usd: compEstimate, source: "psa_estimate" };
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

/** Max gap between anchor sale and (latest.t − lag) for a trustworthy 1y label — aligned with backend. */
export const REFERENCE_LAG_MAX_ANCHOR_GAP_SEC = 90 * 86_400;

export type ReferenceLagAnchor = {
  pct: number;
  refUsd: number;
  refAtSec: number;
  endUsd: number;
  endAtSec: number;
  anchorGapSec: number;
};

/**
 * Latest observation vs last actual sale on or before (latest.t − lagSec) — LOCF.
 * Matches backend {@link referenceLagAnchorFromPoints} in `collection-market.util.ts`.
 */
export function referenceLagAnchorFromPoints(
  points: CollectionUsdPoint[] | null | undefined,
  lagSec: number,
): ReferenceLagAnchor | null {
  const cleaned = (points ?? []).filter(
    (p) =>
      Number.isFinite(p.t) &&
      Number.isFinite(p.v) &&
      p.v > 0,
  );
  if (cleaned.length < 2 || !Number.isFinite(lagSec) || lagSec <= 0) return null;
  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const end = sorted[sorted.length - 1]!;
  const targetT = end.t - lagSec;
  if (targetT < sorted[0]!.t) return null;

  let i0 = -1;
  for (let k = 0; k < sorted.length; k++) {
    if (sorted[k]!.t <= targetT) i0 = k;
    else break;
  }
  if (i0 < 0) return null;

  const anchor = sorted[i0]!;
  const refV = anchor.v;

  if (
    !Number.isFinite(refV) ||
    refV <= 0 ||
    !Number.isFinite(end.v) ||
    end.v <= 0
  ) {
    return null;
  }
  return {
    pct: ((end.v - refV) / refV) * 100,
    refUsd: refV,
    refAtSec: anchor.t,
    endUsd: end.v,
    endAtSec: end.t,
    anchorGapSec: Math.max(0, targetT - anchor.t),
  };
}

/**
 * Reference % change: prefer 1y lookback; if history is shorter, use the full available span.
 */
export function percentChangeReferenceBestWindow(
  points: CollectionUsdPoint[] | null | undefined,
): ReferencePercentChangeResult {
  const empty: ReferencePercentChangeResult = {
    pct: null,
    isFullYear: false,
    windowSec: 0,
  };
  const cleaned = (points ?? []).filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (cleaned.length < 2) return empty;

  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const spanSec = sorted[sorted.length - 1]!.t - sorted[0]!.t;
  if (!(spanSec > 0)) return empty;

  const lag1y = referenceLagAnchorFromPoints(
    points,
    MARKET_PRICE_CHANGE_LAG_SEC,
  );
  const historyCovers1y = referenceHistoryCoversFullYear(spanSec);
  if (lag1y != null && historyCovers1y) {
    return {
      pct: lag1y.pct,
      isFullYear: true,
      windowSec: MARKET_PRICE_CHANGE_LAG_SEC,
      refUsd: lag1y.refUsd,
      refAtSec: lag1y.refAtSec,
    };
  }

  if (historyCovers1y && lag1y == null) {
    const lagSpan = referenceLagAnchorFromPoints(points, spanSec);
    if (lagSpan != null) {
      return {
        pct: lagSpan.pct,
        isFullYear: true,
        windowSec: MARKET_PRICE_CHANGE_LAG_SEC,
        refUsd: lagSpan.refUsd,
        refAtSec: lagSpan.refAtSec,
      };
    }
  }

  const lagSpan = referenceLagAnchorFromPoints(points, spanSec);
  const pct =
    lagSpan?.pct ?? percentChangeFromUsdPoints(points);

  return {
    pct,
    isFullYear: false,
    windowSec: spanSec,
    refUsd: lagSpan?.refUsd ?? null,
    refAtSec: lagSpan?.refAtSec ?? null,
  };
}

/** Latest % from {@link percentChangeReferenceBestWindow}. */
export function percentChangeReferenceOver1Yr(
  points: CollectionUsdPoint[] | null | undefined,
): number | null {
  return percentChangeReferenceBestWindow(points).pct;
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
