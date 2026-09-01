import type { CollectionMarketBundle } from '../collections/collection-market.service';
import {
  extractBucketComponentsFromMetadata,
  type MarketBucketComponents,
} from './bucket-key.util';
import type { GradePriceStrip } from './collection-market.util';
import { blendCatalogSpotUsdFromPreview } from './market-grade-strip.util';
import type { MarketCollectionPreview } from './market-reference.types';
import {
  marketHistoryTierFromPsaGradeInput,
  parseFiniteGradeScore,
  psaGradePolicyInputFromGraded,
} from './psa-grade-policy.util';

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function gradedFromMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> | null {
  const props = meta.properties as Record<string, unknown> | undefined;
  const g = props?.graded ?? meta.graded;
  return g && typeof g === 'object' ? (g as Record<string, unknown>) : null;
}

function gradeScoreFromMeta(meta: Record<string, unknown>): number | null {
  const graded = gradedFromMeta(meta);
  if (!graded) return null;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  return (
    parseFiniteGradeScore(psa?.gradeScore) ??
    parseFiniteGradeScore(grade?.score) ??
    null
  );
}

function gradeScoreStrFromMeta(meta: Record<string, unknown>): string | null {
  const graded = gradedFromMeta(meta);
  if (!graded) return null;
  const psa = graded.psa as Record<string, unknown> | undefined;
  const grade = graded.grade as Record<string, unknown> | undefined;
  const raw = psa?.gradeScore ?? grade?.score;
  return raw != null ? String(raw) : null;
}

function representativeGradeUsd(
  gradePrices: GradePriceStrip | null | undefined,
  gradeScore: number | null,
  gradeScoreStr?: string | null,
): number | null {
  if (gradeScoreStr?.trim().toLowerCase() === 'auth') {
    return finitePositive(gradePrices?.psa10);
  }
  if (!gradePrices || gradeScore == null || !Number.isFinite(gradeScore)) {
    return null;
  }
  const r = Math.round(gradeScore);
  if (r >= 10) return finitePositive(gradePrices.psa10);
  if (r === 9) return finitePositive(gradePrices.psa9);
  return finitePositive(gradePrices.raw);
}

function pickPortfolioMarketPreview(
  series: CollectionMarketBundle | null | undefined,
  mintPv: MarketCollectionPreview | null | undefined,
): MarketCollectionPreview | null {
  const s = series?.cardhedgerPreview;
  const sOk = Boolean(s?.matched && s?.card);
  const mOk = Boolean(mintPv?.matched && mintPv?.card);
  if (sOk && mOk) return s!;
  if (sOk) return s!;
  if (mOk) return mintPv!;
  return s ?? mintPv ?? null;
}

/** True when portfolio snapshot alone can price a holding (no mint-preview needed). */
export function portfolioSnapshotCanPriceHoldings(
  series: CollectionMarketBundle | null | undefined,
): boolean {
  if (!series) return false;
  const preview = series.cardhedgerPreview;
  if (preview?.matched && preview?.card) return true;
  const gp = series.gradePrices;
  if (
    finitePositive(gp?.psa10) ||
    finitePositive(gp?.psa9) ||
    finitePositive(gp?.raw)
  ) {
    return true;
  }
  return Boolean(
    series.allGradePrices?.some((e) => finitePositive(e.priceUsd)),
  );
}

/** Cardhedger-backed mark for one owned token (snapshot-first, mint preview fallback). */
export function resolveTokenMarkUsd(
  meta: Record<string, unknown>,
  series: CollectionMarketBundle | null | undefined,
  mintPreview: MarketCollectionPreview | null | undefined,
): number | null {
  const preview = pickPortfolioMarketPreview(series, mintPreview);
  const graded = gradedFromMeta(meta);
  const tier = marketHistoryTierFromPsaGradeInput(
    graded ? psaGradePolicyInputFromGraded(graded) : {},
  );

  if (preview?.matched && preview.card) {
    const poke = blendCatalogSpotUsdFromPreview(preview, tier);
    if (poke != null) return poke;
  }

  const strip = representativeGradeUsd(
    series?.gradePrices ?? null,
    gradeScoreFromMeta(meta),
    gradeScoreStrFromMeta(meta),
  );
  return strip;
}

export function componentsFromMetadata(
  meta: Record<string, unknown>,
): MarketBucketComponents | null {
  return extractBucketComponentsFromMetadata(meta);
}
