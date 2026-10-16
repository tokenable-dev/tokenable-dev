import type { MarketCollectionPreview } from './market-reference.types';
import type { GradePriceStrip } from './collection-market.util';

type NmBand = {
  avg: number | null;
  low: number | null;
  high: number | null;
} | null;

function pickBandAvg(b: NmBand): number | null {
  if (!b) return null;
  if (b.avg != null && Number.isFinite(b.avg) && b.avg > 0) return b.avg;
  if (
    b.low != null &&
    b.high != null &&
    Number.isFinite(b.low) &&
    Number.isFinite(b.high) &&
    b.low > 0 &&
    b.high > 0
  ) {
    return (b.low + b.high) / 2;
  }
  return null;
}

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function blendCatalogSpotUsdFromPreview(
  preview: MarketCollectionPreview,
  historyTier: string,
): number | null {
  if (!preview.matched || !preview.card) return null;
  const c = preview.card;
  const tier = String(historyTier ?? '').trim();
  const fromMap =
    c.ebayPsaTiers && tier.startsWith('PSA_')
      ? pickBandAvg(c.ebayPsaTiers[tier] ?? null)
      : null;
  if (fromMap != null) return fromMap;
  if (historyTier === 'PSA_10') {
    const v = pickBandAvg(c.ebayPsa10 ?? null);
    return v;
  }
  if (historyTier === 'PSA_AUTH') {
    const v = pickBandAvg(c.ebayPsaTiers?.PSA_AUTH ?? null);
    if (v != null) return v;
    return finitePositive(c.topPrice);
  }
  return null;
}

export function gradeStripFromHistoryTier(
  historyTier: string,
  spotUsd: number | null,
): GradePriceStrip {
  if (spotUsd == null || !Number.isFinite(spotUsd) || spotUsd <= 0) {
    return { psa10: null, psa9: null, raw: null };
  }
  const tier = String(historyTier ?? '').trim().toUpperCase();
  if (tier === 'PSA_10') return { psa10: spotUsd, psa9: null, raw: null };
  if (tier === 'PSA_9') return { psa10: null, psa9: spotUsd, raw: null };
  if (tier === 'PSA_AUTH') return { psa10: spotUsd, psa9: null, raw: null };
  if (/^PSA_[1-8]$/.test(tier)) {
    return { psa10: null, psa9: null, raw: spotUsd };
  }
  return { psa10: null, psa9: null, raw: null };
}

export const MARKET_NM_HISTORY_MAX_DAYS = 365;

/** Chart MAX range — full comps-merged archive in snapshot (Cardhedger comps cap). */
export const CHART_FULL_COMPS_ARCHIVE_MAX_DAYS = 4000;

export type ChartHistoryWindow =
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'max';

export function chartHistoryWindowFromCalendarDays(
  maxCalendarDays: number,
): ChartHistoryWindow {
  const d = Math.max(1, Math.floor(maxCalendarDays));
  if (d >= CHART_FULL_COMPS_ARCHIVE_MAX_DAYS) return 'max';
  if (d >= MARKET_NM_HISTORY_MAX_DAYS) return '365d';
  if (d >= 180) return '180d';
  if (d >= 90) return '90d';
  if (d >= 30) return '30d';
  return '7d';
}

export function nmHistoryDaysForBundleWindow(w: ChartHistoryWindow): number {
  switch (w) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '180d':
      return 180;
    case '365d':
      return MARKET_NM_HISTORY_MAX_DAYS;
    case 'max':
      return CHART_FULL_COMPS_ARCHIVE_MAX_DAYS;
    default:
      return 30;
  }
}
