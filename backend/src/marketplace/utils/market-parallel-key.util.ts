import { cardhedgerRowMatchesPsaVariety } from './cardhedger-psa-variety.util';
import { psaVarietyRequiresNonBaseCardhedgerRow } from '../../psa/psa-variety-catalog.util';

function slugifyParallelKey(raw: string): string {
  return (
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 96) || 'base'
  );
}

/**
 * Stable bucket facet: PSA `Variety` when it names a parallel; otherwise `base`.
 * Used in {@link computeMarketBucketKey} v2 so Base vs Refractor do not share one collection.
 *
 * Do not strip print-run suffixes here — `collection_key` v2 must stay stable for existing
 * orders. Matching uses {@link normalizePsaVarietyForMatch} separately.
 */
export function marketParallelKeyFromPsaVariety(
  psaVariety: string | null | undefined,
  brandOrSet?: string | null,
): string {
  const raw = String(psaVariety ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!raw) return 'base';
  if (!psaVarietyRequiresNonBaseCardhedgerRow(raw, brandOrSet)) return 'base';
  return slugifyParallelKey(raw);
}

export function cardhedgerRowMatchesMarketParallelKey(
  row: Record<string, unknown>,
  marketParallelKey: string,
  psaVariety: string | null | undefined,
): boolean {
  const key = (marketParallelKey || 'base').trim().toLowerCase();
  if (key === 'base') {
    const vr = String(row.variant ?? '')
      .trim()
      .toLowerCase();
    return vr === '' || vr === 'base';
  }
  const pv = String(psaVariety ?? '').trim();
  if (pv) {
    return cardhedgerRowMatchesPsaVariety(row, pv);
  }
  const variantSlug = slugifyParallelKey(String(row.variant ?? ''));
  return (
    variantSlug === key ||
    variantSlug.includes(key) ||
    key.includes(variantSlug)
  );
}
