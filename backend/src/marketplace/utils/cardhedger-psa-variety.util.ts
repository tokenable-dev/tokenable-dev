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

/**
 * Print-finish words. Named catalog variants (Master Ball, Silver Prizm, …) often omit these
 * even when PSA Variety includes them (`MASTER BALL REVERSE HOLO` → `variant: "Master Ball"`).
 * Not a list of collectible names — only treatment/finish tokens.
 */
const PRINT_FINISH_TOKENS = new Set([
  'reverse',
  'holo',
  'foil',
  'holofoil',
  'holographic',
]);

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

function synonymizeToken(t: string): string {
  if (t === 'foil' || t === 'holofoil' || t === 'holographic') return 'holo';
  return t;
}

function varietyMatchChunks(psaVariety: string): string[] {
  const v = psaVariety.trim().toLowerCase();
  if (psaVarietyIsGenericSportRefractorLine(v)) {
    return ['refractor', ...chromeColorTokensIn(v)].map(synonymizeToken);
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
  return [...out].filter((c) => c.length >= 2).map(synonymizeToken);
}

function namedIdentityTokens(tokens: string[]): string[] {
  return tokens.filter((t) => t !== 'base' && !PRINT_FINISH_TOKENS.has(t));
}

function blobHasVarietyChunk(blob: string, chunk: string): boolean {
  if (blob.includes(chunk)) return true;
  if (chunk === 'holo') {
    return blob.includes('foil') || blob.includes('holofoil');
  }
  return false;
}

function variantFieldTokens(row: Record<string, unknown>): string[] {
  return varietyMatchChunks(String(row.variant ?? '')).filter((t) => t !== 'base');
}

/**
 * How many collectible-defining (non-finish) tokens in Cardhedger `variant` are
 * covered by PSA Variety. 0 when the row is incompatible or finish-only.
 */
export function cardhedgerCatalogVariantSpecificity(
  row: Record<string, unknown>,
  psaVariety: string | null | undefined,
): number {
  if (!cardhedgerRowMatchesPsaVariety(row, psaVariety)) return 0;
  const psa = new Set(varietyMatchChunks(String(psaVariety ?? '')));
  return namedIdentityTokens(variantFieldTokens(row)).filter((t) =>
    psa.has(t),
  ).length;
}

/**
 * PSA Variety names a collectible identity beyond print finish
 * (`MASTER BALL REVERSE HOLO` vs `REVERSE HOLO`).
 */
export function psaVarietyHasNamedCollectibleIdentity(
  psaVariety: string | null | undefined,
): boolean {
  const pv = String(psaVariety ?? '').trim();
  if (!pv || !psaVarietyRequiresNonBaseCardhedgerRow(pv)) return false;
  return namedIdentityTokens(varietyMatchChunks(pv)).length > 0;
}

/** Catalog `variant` is only a print finish (Reverse Foil / Reverse Holo), not a named parallel. */
export function cardhedgerRowIsPrintFinishOnly(
  row: Record<string, unknown>,
): boolean {
  const vt = variantFieldTokens(row);
  return vt.length > 0 && namedIdentityTokens(vt).length === 0;
}

/**
 * PSA Variety blank → flagship/base catalog line only.
 * GemRate cert lookup can attach 1/1 or insert rows (e.g. Superfractor) when PSA
 * prints no parallel on the label.
 */
export function cardhedgerRowImpliedParallelWithoutPsaVariety(
  row: Record<string, unknown>,
): boolean {
  const blob = rowParallelBlob(row);
  if (cardhedgerRowParallelFlavorConflict('', blob)) return true;

  const variant = String(row.variant ?? '').trim();
  if (!variant || /^base$/i.test(variant)) return false;

  if (cardhedgerRowIsPrintFinishOnly(row)) return true;

  const variantTokens = variantFieldTokens(row);
  return namedIdentityTokens(variantTokens).length > 0;
}

/** Cardhedger catalog row compatible with PSA PSACert.Variety (PSA is authoritative). */
export function cardhedgerRowMatchesPsaVariety(
  row: Record<string, unknown>,
  psaVariety: string | null | undefined,
): boolean {
  const pv = String(psaVariety ?? '').trim();
  if (!pv) {
    return !cardhedgerRowImpliedParallelWithoutPsaVariety(row);
  }
  if (!psaVarietyRequiresNonBaseCardhedgerRow(pv)) return true;

  const blob = rowParallelBlob(row);
  if (cardhedgerRowParallelFlavorConflict(pv, blob)) return false;

  const psaTokens = new Set(varietyMatchChunks(pv));
  const variantTokens = variantFieldTokens(row);
  const rowIdentity = namedIdentityTokens(variantTokens);

  /**
   * Catalog `variant` may be more specific than PSA (Master Ball vs Reverse Holo).
   * Extra named identity on the row is a mismatch even if the blob contains PSA's finish line.
   */
  for (const t of rowIdentity) {
    if (!psaTokens.has(t)) return false;
  }

  if (blob.includes(pv.toLowerCase())) return true;

  /**
   * Named catalog variant is a phrase inside PSA Variety; leftover PSA tokens are only
   * print finish (`REVERSE HOLO` on a Master Ball slab). Do not require those finish
   * tokens to appear on the Cardhedger row.
   */
  if (
    variantTokens.length > 0 &&
    variantTokens.every((t) => psaTokens.has(t))
  ) {
    const leftoverIdentity = [...psaTokens].filter(
      (t) => !variantTokens.includes(t) && !PRINT_FINISH_TOKENS.has(t),
    );
    if (leftoverIdentity.length === 0) return true;
    /**
     * PSA One Piece championship stamps: `Championship 2024-Top Prize`.
     * Cardhedger files the same overlay as `variant: "Championship 2024"`
     * (distinct from other characters' `Top Prize` / Finalist / Top Player).
     */
    if (
      leftoverIdentity.every(
        (t) => t === 'top' || t === 'prize' || t === 'event',
      ) &&
      variantTokens.includes('championship') &&
      variantTokens.some((t) => /^20\d{2}$/.test(t) && psaTokens.has(t))
    ) {
      return true;
    }
    /**
     * PSA One Piece manga AA: `RED MANGA ALTERNATE ART`.
     * Cardhedger files that print as `variant: "Red Manga"` (not `Alternate Art`).
     * Leftover `alternate`/`art` is the PSA rarity line, not the regular AA row.
     */
    if (
      leftoverIdentity.every((t) => t === 'alternate' || t === 'art') &&
      leftoverIdentity.length > 0 &&
      variantTokens.includes('manga') &&
      variantTokens.includes('red')
    ) {
      return true;
    }
  }

  const chunks = varietyMatchChunks(pv);
  if (chunks.length === 0) return true;
  return chunks.every((c) => blobHasVarietyChunk(blob, c));
}

/**
 * Cert / `prices-by-cert` rows are usable only when they pass the same variety gate
 * as catalog search. Empty row is only OK when PSA Variety has no named identity.
 */
export function cardhedgerCertRowUsableForPsaVariety(
  row: Record<string, unknown> | null | undefined,
  psaVariety: string | null | undefined,
): boolean {
  if (!row) return !psaVarietyHasNamedCollectibleIdentity(psaVariety);
  return cardhedgerRowMatchesPsaVariety(row, psaVariety);
}
