import {
  chromeColorTokensIn,
  psaVarietyIsGenericSportRefractorLine,
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';

function rowParallelBlob(row: Record<string, unknown>): string {
  return [row.variant, row.description, row.name, row.set, row.set_type]
    .map((x) => String(x ?? ''))
    .join(' ')
    .toLowerCase();
}

/**
 * Cardhedger `variant` flavors that distinguish parallels (e.g. Blue Wave vs Blue Refractor).
 * If the row asserts one PSA did not include, the row is incompatible — chunk matching on
 * shared tokens like `blue` + `refractor` is not enough.
 */
const PARALLEL_FLAVOR_MARKERS = [
  'wave',
  'raywave',
  'rwb',
  'pulsar',
  'sepia',
  'shimmer',
  'mojo',
  'atomic',
  'negative',
  'superfractor',
  'xfractor',
  'speckle',
  'lava',
  'autograph',
  'patch',
  'relic',
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parallelFlavorMarkersIn(text: string): string[] {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const found: string[] = [];
  if (/\bblue\s+wave\b/.test(t)) found.push('blue wave');
  for (const m of PARALLEL_FLAVOR_MARKERS) {
    if (new RegExp(`\\b${escapeRegExp(m)}\\b`).test(t)) found.push(m);
  }
  return found;
}

/** Row names a parallel flavor PSA's Variety line does not (e.g. Wave on a Blue Refractor cert). */
function cardhedgerRowParallelFlavorConflict(
  psaVariety: string,
  rowBlob: string,
): boolean {
  const psaT = psaVariety.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const marker of parallelFlavorMarkersIn(rowBlob)) {
    if (marker === 'blue wave') {
      if (!/\bblue\s+wave\b/.test(psaT) && !/\bwave\b/.test(psaT)) return true;
      continue;
    }
    if (!new RegExp(`\\b${escapeRegExp(marker)}\\b`).test(psaT)) return true;
  }
  return false;
}

function varietyMatchChunks(psaVariety: string): string[] {
  const v = psaVariety.trim().toLowerCase();
  if (psaVarietyIsGenericSportRefractorLine(v)) {
    return ['refractor', ...chromeColorTokensIn(v)];
  }
  const parts = v
    .split(/[\s.\-/]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const out = new Set(parts);
  for (const sport of [
    'basketball',
    'baseball',
    'football',
    'hockey',
    'soccer',
  ]) {
    out.delete(sport);
  }
  if ([...out].some((p) => p === 'grn' || p.includes('grn'))) {
    out.add('green');
    out.delete('grn');
  }
  if ([...out].some((p) => p.includes('gems') || p === 'metal' || p === 'prec')) {
    out.add('precious');
    out.add('metal');
    out.add('gems');
    out.delete('prec');
  }
  if ([...out].some((p) => p.includes('champ'))) out.add('championship');
  return [...out].filter((c) => c.length >= 2);
}

/** Cardhedger catalog row compatible with PSA PSACert.Variety (PSA is authoritative). */
export function cardhedgerRowMatchesPsaVariety(
  row: Record<string, unknown>,
  psaVariety: string | null | undefined,
): boolean {
  const pv = String(psaVariety ?? '').trim();
  if (!pv) return true;
  if (!psaVarietyRequiresNonBaseCardhedgerRow(pv)) return true;

  const blob = rowParallelBlob(row);
  const v = pv.toLowerCase();
  if (cardhedgerRowParallelFlavorConflict(pv, blob)) return false;
  if (blob.includes(v)) return true;

  const chunks = varietyMatchChunks(v);
  if (chunks.length === 0) return true;
  return chunks.every((c) => blob.includes(c));
}
