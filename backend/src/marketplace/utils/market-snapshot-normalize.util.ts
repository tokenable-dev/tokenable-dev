import type { GradePriceStrip, UsdPoint } from './collection-market.util';
import { percentChangeReferenceOverLagSec } from './collection-market.util';
import type { CollectionMarketSnapshotState } from '../entities/collection-market-snapshot.entity';
import type { MarketCollectionPreview } from './market-reference.types';
import {
  blendCatalogSpotUsdFromPreview,
  gradeStripFromHistoryTier,
} from './market-grade-strip.util';
import type { MaterializedMarketSnapshotPayload } from './market-snapshot.types';
import { MARKET_SNAPSHOT_SOURCE_VERSION } from './market-snapshot.types';
import {
  CHART_FULL_COMPS_ARCHIVE_MAX_DAYS,
  type ChartHistoryWindow,
  nmHistoryDaysForBundleWindow,
} from './market-grade-strip.util';

const SEC_DAY = 86_400;

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

function priceFromGradeMap(
  map: Record<string, number> | undefined,
  keys: string[],
): number | null {
  if (!map) return null;
  for (const k of keys) {
    const v = map[k];
    const p = finitePositive(v);
    if (p != null) return p;
  }
  return null;
}

/** Extract PSA10 / PSA9 / raw USD from Cardhedger preview bands and grade map. */
export function extractGradePricesFromPreview(
  preview: MarketCollectionPreview,
  historyTier: string,
): GradePriceStrip {
  const catalogSpot = blendCatalogSpotUsdFromPreview(preview, historyTier);
  const base = gradeStripFromHistoryTier(historyTier, catalogSpot);
  if (!preview.matched || !preview.card) return base;

  const c = preview.card;
  const byGrade = c.pricesByGrade;
  const tierKey = String(historyTier ?? '').trim().toUpperCase();
  const tierGradeLabel =
    tierKey.startsWith('PSA_') && tierKey !== 'PSA_AUTH'
      ? `PSA ${tierKey.replace('PSA_', '')}`
      : null;
  const tierFromMap =
    tierGradeLabel != null
      ? priceFromGradeMap(byGrade, [
          tierKey,
          tierGradeLabel,
          tierGradeLabel.replace(' ', ''),
        ])
      : null;

  const psa10 =
    finitePositive(c.topPrice) ??
    priceFromGradeMap(byGrade, ['PSA_10', 'PSA10', 'psa10']) ??
    (tierKey === 'PSA_10' ? tierFromMap : null) ??
    base.psa10;
  const psa9 =
    priceFromGradeMap(byGrade, ['PSA_9', 'PSA9', 'psa9']) ??
    finitePositive(c.ebayPsa9?.avg ?? null) ??
    (tierKey === 'PSA_9' ? tierFromMap : null) ??
    base.psa9;
  const raw =
    priceFromGradeMap(byGrade, ['NEAR_MINT', 'RAW', 'NM', 'Ungraded']) ??
    finitePositive(c.ebayNearMint?.avg ?? null) ??
    base.raw;

  const tierSpot =
    tierFromMap ??
    (tierKey === 'PSA_10'
      ? psa10
      : tierKey === 'PSA_9'
        ? psa9
        : /^PSA_[1-8]$/.test(tierKey)
          ? tierFromMap ?? raw
          : null);

  return {
    psa10: psa10 ?? (tierKey === 'PSA_10' ? tierSpot : null) ?? base.psa10,
    psa9: psa9 ?? (tierKey === 'PSA_9' ? tierSpot : null) ?? base.psa9,
    raw:
      raw ??
      (/^PSA_[1-8]$/.test(tierKey) ? tierSpot : null) ??
      base.raw,
  };
}

/** 0–100 score from match confidence + liquidity signals. */
export function computeSnapshotReliabilityScore(
  preview: MarketCollectionPreview,
): number | null {
  if (!preview.matched || !preview.card) return null;
  let score = preview.matchConfidence === 'verified' ? 72 : 48;
  if (preview.card.priceReliability === 'high') score += 18;
  else if (preview.card.priceReliability === 'low') score -= 12;
  const s30 = preview.card.sales30d ?? 0;
  if (s30 >= 20) score += 10;
  else if (s30 >= 5) score += 5;
  else if (s30 === 0) score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function downsampleSparkPoints(
  points: UsdPoint[],
  maxPoints: number,
): UsdPoint[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const out: UsdPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(points[Math.min(idx, points.length - 1)]);
  }
  return out;
}

export function filterExternalUsdByDays(
  points: UsdPoint[],
  maxDays: number,
): UsdPoint[] {
  if (points.length === 0) return [];
  const cutoff = Math.floor(Date.now() / 1000) - maxDays * SEC_DAY;
  return points.filter((p) => p.t >= cutoff);
}

/**
 * Chart window: anchored to latest sale. `max` returns full comps-merged archive.
 */
export function filterExternalUsdForChartWindow(
  points: UsdPoint[],
  window: ChartHistoryWindow,
): UsdPoint[] {
  const cleaned = points.filter(
    (p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0,
  );
  if (cleaned.length === 0) return [];

  const sorted = [...cleaned].sort((a, b) => a.t - b.t);
  const lastT = sorted[sorted.length - 1]!.t;

  if (window === 'max') {
    const archiveCutoff =
      lastT - CHART_FULL_COMPS_ARCHIVE_MAX_DAYS * SEC_DAY;
    return sorted.filter((p) => p.t >= archiveCutoff);
  }

  const maxDays = nmHistoryDaysForBundleWindow(window);
  const cutoff = lastT - maxDays * SEC_DAY;
  return sorted.filter((p) => p.t >= cutoff);
}

export function computeChangePctLag(
  externalUsd: UsdPoint[],
  lagDays: number,
): number | null {
  return percentChangeReferenceOverLagSec(externalUsd, lagDays * SEC_DAY);
}

export function categoryLabelFromPreview(
  preview: MarketCollectionPreview,
): string | null {
  if (!preview.matched || !preview.card) return null;
  const parts = [preview.card.setName, preview.card.name]
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function syncExternalTerminalWithHeadline(
  externalUsd: UsdPoint[],
  headlineUsd: number | null,
): UsdPoint[] {
  if (
    headlineUsd == null ||
    !Number.isFinite(headlineUsd) ||
    headlineUsd <= 0 ||
    externalUsd.length === 0
  ) {
    return externalUsd;
  }
  const last = externalUsd[externalUsd.length - 1]!;
  const eps = Math.max(1e-6, Math.abs(headlineUsd) * 1e-9);
  if (Math.abs(last.v - headlineUsd) <= eps) return externalUsd;
  return [...externalUsd.slice(0, -1), { t: last.t, v: headlineUsd }];
}

export function buildMaterializedSnapshotPayload(input: {
  collectionKey: string;
  historyTier: string;
  preview: MarketCollectionPreview;
  historyPoints: UsdPoint[];
  /**
   * Optional PSA estimate fallback (when Cardhedger comp/preview is unmatched).
   * When provided and gradePrices are empty, we fill `psa10` so the UI can show a defensible
   * market price.
   */
  psaEstimateUsd?: number | null;
}): MaterializedMarketSnapshotPayload {
  const key = input.collectionKey.toLowerCase();
  const headlineUsd =
    finitePositive(input.preview.card?.topPrice ?? null) ??
    finitePositive(
      blendCatalogSpotUsdFromPreview(input.preview, input.historyTier),
    );
  let externalUsd = input.historyPoints.map((p) => ({ t: p.t, v: p.v }));
  externalUsd = syncExternalTerminalWithHeadline(externalUsd, headlineUsd);

  let gradePrices = extractGradePricesFromPreview(
    input.preview,
    input.historyTier,
  );

  // When Cardhedger doesn't match / lacks defensible bands, extractGradePricesFromPreview can
  // return an empty strip. In that case, fall back to PSA estimate so we still display a
  // "market-like" price.
  if (
    input.psaEstimateUsd != null &&
    Number.isFinite(input.psaEstimateUsd) &&
    input.psaEstimateUsd > 0 &&
    gradePrices.psa10 == null
  ) {
    gradePrices = { ...gradePrices, psa10: input.psaEstimateUsd };
  }
  const spark90 = downsampleSparkPoints(
    filterExternalUsdByDays(externalUsd, 90),
    48,
  );

  const marketState: CollectionMarketSnapshotState = input.preview.matched
    ? 'fresh'
    : input.preview.enabled
      ? 'empty'
      : 'error';

  return {
    collectionKey: key,
    cardhedgerCardId: input.preview.card?.id?.trim() || null,
    psa10Usd: gradePrices.psa10,
    psa9Usd: gradePrices.psa9,
    rawUsd: gradePrices.raw,
    headlineUsd,
    spotPriceBasis:
      input.preview.card?.spotPriceBasis?.trim() ||
      null,
    change7dPct: computeChangePctLag(externalUsd, 7),
    change30dPct: computeChangePctLag(externalUsd, 30),
    sparkline90dJson: spark90,
    previewJson: input.preview,
    externalUsdJson: externalUsd,
    gradePricesJson: gradePrices,
    categoryLabel: categoryLabelFromPreview(input.preview),
    historyTier: input.historyTier,
    reliabilityScore: computeSnapshotReliabilityScore(input.preview),
    marketState,
    sourceVersion: MARKET_SNAPSHOT_SOURCE_VERSION,
  };
}

export function isSnapshotRowStale(
  staleAfter: Date | null,
  nowMs = Date.now(),
): boolean {
  if (!staleAfter) return true;
  return nowMs >= staleAfter.getTime();
}
