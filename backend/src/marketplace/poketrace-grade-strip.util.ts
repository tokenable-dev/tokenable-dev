import type { PoketraceCollectionPreview } from '../poketrace/poketrace.service';
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

/**
 * Same blend order as frontend {@link blendNearMintUnitUsd}.
 * Approximate catalog matches still expose NM bands when PokeTrace returns them (list / bundle UX).
 */
export function blendNearMintUnitUsdFromPreview(
  preview: PoketraceCollectionPreview,
): number | null {
  if (!preview.matched || !preview.card) return null;

  const c = preview.card;
  const e = pickBandAvg(c.ebayNearMint);
  const t = pickBandAvg(c.tcgplayerNearMint);

  if (e != null && t != null) return (e + t) / 2;
  if (e != null) return e;
  if (t != null) return t;

  const top = c.topPrice;
  if (typeof top === 'number' && Number.isFinite(top) && top > 0) return top;

  return null;
}

/**
 * List / bundle compatibility: one NM reference repeated on all strip slots
 * (we do not have separate PSA10/9/Raw from PokeTrace on the public NM tier).
 */
export function gradeStripFromPoketraceNm(nm: number | null): GradePriceStrip {
  if (nm == null || !Number.isFinite(nm) || nm <= 0) {
    return { psa10: null, psa9: null, raw: null };
  }
  return { psa10: nm, psa9: nm, raw: nm };
}

/**
 * Spot USD for list/bundle header: PSA tier eBay band when chart uses that tier, else NM blend.
 */
export function blendCatalogSpotUsdFromPreview(
  preview: PoketraceCollectionPreview,
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
    if (v != null) return v;
  }
  if (historyTier === 'PSA_9') {
    const v = pickBandAvg(c.ebayPsa9 ?? null);
    if (v != null) return v;
  }
  return blendNearMintUnitUsdFromPreview(preview);
}

/** Align `gradePrices` strip with the tier used for `externalUsd` history. */
export function gradeStripFromHistoryTier(
  historyTier: string,
  spotUsd: number | null,
): GradePriceStrip {
  if (spotUsd == null || !Number.isFinite(spotUsd) || spotUsd <= 0) {
    return { psa10: null, psa9: null, raw: null };
  }
  if (historyTier === 'PSA_10') return { psa10: spotUsd, psa9: null, raw: null };
  if (historyTier === 'PSA_9') return { psa10: null, psa9: spotUsd, raw: null };
  /** PSA_1…PSA_8 etc.: bundle strip has no extra slots — stash tier spot on `raw` for list math */
  if (/^PSA_\d+$/.test(historyTier)) {
    return { psa10: null, psa9: null, raw: spotUsd };
  }
  return gradeStripFromPoketraceNm(spotUsd);
}

/** PokeTrace `days` clamp upper bound (see `getNearMintHistoryForCollection`). */
export const POKETRACE_NM_HISTORY_MAX_DAYS = 365;

export function nmHistoryDaysForBundleWindow(
  w: '7d' | '30d' | '90d' | '180d' | '365d',
): number {
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
      return POKETRACE_NM_HISTORY_MAX_DAYS;
    default:
      return 30;
  }
}
