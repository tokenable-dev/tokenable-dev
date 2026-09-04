import {
  chromeColorTokensIn,
  psaVarietyIsGenericSportRefractorLine,
  psaVarietyRequiresNonBaseCardhedgerRow,
} from '../../psa/psa-variety-catalog.util';

function rowParallelBlob(row: Record<string, unknown>): string {
  return [row.variant, row.description, row.name, row.set, row.set_type]
    .map((x) => String(x ?? ''))
    .join(' ')
    .toLowerCase()
    // Cardhedger OCR/catalog typos for Topps image variations.
    .replace(/\bvatiation\b/g, 'variation');
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
  'prism',
  'speckle',
  'lava',
  'autograph',
  'patch',
  'relic',
  'variation',
  'printing',
  'plate',
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

/**
 * Sports photo-pose words. PSA often prints only the parallel (`BLUE REFRACTOR`) while
 * Cardhedger splits the same checklist # into `Pitching Blue Refractor` / `Batting …`.
 * Pose on the catalog row is not a parallel flavor — do not reject solely for extra pose.
 * When PSA *does* name a pose, chunk matching still requires it on the row.
 */
const SPORT_POSE_TOKENS = new Set([
  'pitching',
  'batting',
  'fielding',
  'running',
  'sliding',
  'catching',
  'throwing',
  'posing',
  'portrait',
  'horizontal',
  'vertical',
]);

/** Chrome color words — used to tell flagship color parallels from SP name colors (Red Jersey). */
const CHROME_COLOR_TOKEN_SET = new Set([
  'orange',
  'gold',
  'green',
  'purple',
  'blue',
  'red',
  'pink',
  'black',
  'sepia',
  'aqua',
  'yellow',
]);

/**
 * Cardhedger often names the image-variation photo by a visual cue (`Red Jersey Refractor`)
 * while PSA Spec Variety stays `VARIATION-REFRACTOR` (label may also say RED JERSEY-REFRACTOR).
 */
function rowHasImageVariationSpCue(blob: string): boolean {
  if (/\bvariation\b/.test(blob)) return true;
  if (/\bjersey\b/.test(blob)) return true;
  if (/\bshort\s*prints?\b/.test(blob)) return true;
  return false;
}

function psaVarietyNamesImageVariation(psaVariety: string): boolean {
  return /\bvariation\b/i.test(psaVariety);
}

function rowTokenAllowedForImageVariationPsa(
  token: string,
  psaTokens: Set<string>,
  psaVariety: string,
  blob: string,
): boolean {
  if (psaTokens.has(token)) return true;
  if (SPORT_POSE_TOKENS.has(token)) return true;
  if (!psaVarietyNamesImageVariation(psaVariety)) return false;
  if (!rowHasImageVariationSpCue(blob)) return false;
  if (token === 'jersey' || token === 'dugout' || token === 'warmup') {
    return true;
  }
  if (CHROME_COLOR_TOKEN_SET.has(token)) {
    const psaColors = chromeColorTokensIn(psaVariety);
    // VARIATION-ORANGE + "Blue Jersey" would conflict; same color or no PSA color is OK.
    if (psaColors.length > 0 && !psaColors.includes(token)) return false;
    return true;
  }
  return false;
}

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
  if (t === 'vatiation') return 'variation';
  return t;
}

/**
 * PSA pop/checklist UIs often append print-run (`BLUE REFRACTOR /150`).
 * Official cert Variety is usually without it — strip so `/150` is not an identity token.
 */
export function normalizePsaVarietyForMatch(
  psaVariety: string | null | undefined,
): string {
  return String(psaVariety ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*\d+\s*$/i, '')
    .replace(/\bx\s*[- ]?\s*fractor\b/gi, 'xfractor')
    .replace(/\bvatiation\b/gi, 'variation')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function varietyMatchChunks(psaVariety: string): string[] {
  const normalized = normalizePsaVarietyForMatch(psaVariety).toLowerCase();
  if (!normalized) return [];
  if (psaVarietyIsGenericSportRefractorLine(normalized)) {
    return ['refractor', ...chromeColorTokensIn(normalized)].map(
      synonymizeToken,
    );
  }
  const parts = normalized
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
  // Print-run numerals (`/150`, `/99`) — not parallel identity. Keep years for stamps.
  for (const p of [...out]) {
    if (/^\d+$/.test(p) && !/^(19|20)\d{2}$/.test(p)) out.delete(p);
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

function rowLooksLikeImageVariation(row: Record<string, unknown>): boolean {
  const blob = rowParallelBlob(row);
  return /\bvariation\b/.test(blob);
}

function namedIdentityTokens(tokens: string[]): string[] {
  return tokens.filter(
    (t) =>
      t !== 'base' &&
      !PRINT_FINISH_TOKENS.has(t) &&
      !SPORT_POSE_TOKENS.has(t),
  );
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
 * PSA Variety blank / generic BASE → flagship catalog line only.
 * GemRate cert lookup can attach 1/1 or insert rows (e.g. Superfractor) when PSA
 * prints no parallel on the label.
 *
 * Cardhedger often files sports base poses as `Base - Pitching` / `Base - Batting`.
 * Those are still base catalog lines (not chrome parallels) — accept them when PSA
 * Variety is empty so cert pricing (e.g. Ohtani Topps Chrome #150) is not dropped.
 *
 * Image **Variation** (`Base - Variation`) is a different PSA Spec family — reject it
 * for blank/BASE Variety even though the catalog prefix is `Base`.
 */
export function cardhedgerRowImpliedParallelWithoutPsaVariety(
  row: Record<string, unknown>,
): boolean {
  const blob = rowParallelBlob(row);
  if (cardhedgerRowParallelFlavorConflict('', blob)) return true;
  if (rowLooksLikeImageVariation(row)) return true;

  const variant = String(row.variant ?? '').trim();
  // Exact `Base`, or pose subtypes like `Base - Pitching` (not Variation).
  if (!variant || /^base(\b|$)/i.test(variant)) return false;

  if (cardhedgerRowIsPrintFinishOnly(row)) return true;

  const variantTokens = variantFieldTokens(row);
  return namedIdentityTokens(variantTokens).length > 0;
}

/** Cardhedger catalog row compatible with PSA PSACert.Variety (PSA is authoritative). */
export function cardhedgerRowMatchesPsaVariety(
  row: Record<string, unknown>,
  psaVariety: string | null | undefined,
): boolean {
  const pv = normalizePsaVarietyForMatch(psaVariety);
  // Blank / BASE / sport-only / Pokémon rarity-slot → flagship catalog only.
  // Do not `return true` for every row (that used to accept Superfractor on BASE).
  if (!pv || !psaVarietyRequiresNonBaseCardhedgerRow(pv)) {
    return !cardhedgerRowImpliedParallelWithoutPsaVariety(row);
  }

  const blob = rowParallelBlob(row);
  if (cardhedgerRowParallelFlavorConflict(pv, blob)) return false;

  const psaTokens = new Set(varietyMatchChunks(pv));
  const variantTokens = variantFieldTokens(row);
  const rowIdentity = namedIdentityTokens(variantTokens);

  /**
   * Catalog `variant` may be more specific than PSA (Master Ball vs Reverse Holo).
   * Extra named identity on the row is a mismatch even if the blob contains PSA's finish line.
   * Exception: PSA `VARIATION-*` vs Cardhedger SP photo names (`Red Jersey Refractor`).
   */
  for (const t of rowIdentity) {
    if (!rowTokenAllowedForImageVariationPsa(t, psaTokens, pv, blob)) {
      return false;
    }
  }

  if (blob.includes(pv.toLowerCase())) return true;

  /**
   * Named catalog variant is a phrase inside PSA Variety; leftover PSA tokens are only
   * print finish (`REVERSE HOLO` on a Master Ball slab). Do not require those finish
   * tokens to appear on the Cardhedger row.
   */
  const variantTokensCoveredByPsa = variantTokens.every((t) =>
    rowTokenAllowedForImageVariationPsa(t, psaTokens, pv, blob),
  );
  if (variantTokens.length > 0 && variantTokensCoveredByPsa) {
    const leftoverIdentity = [...psaTokens].filter((t) => {
      if (variantTokens.includes(t) || PRINT_FINISH_TOKENS.has(t)) return false;
      // PSA Spec says VARIATION; Cardhedger SP cue (jersey / variation) stands in.
      if (
        t === 'variation' &&
        psaVarietyNamesImageVariation(pv) &&
        rowHasImageVariationSpCue(blob)
      ) {
        return false;
      }
      return true;
    });
    if (leftoverIdentity.length === 0) return true;
    /**
     * Topps Chrome: Cardhedger often shortens `Green Wave Refractor` → `Green Wave` /
     * `Pitching Prism` (omits the word Refractor). When a non-variation parallel anchor
     * (color / wave / prism / …) from PSA is on the row, leftover `refractor` alone is OK.
     * Do **not** treat image-variation base (`Base - Variation`) as a Refractor parallel.
     */
    if (
      leftoverIdentity.length === 1 &&
      leftoverIdentity[0] === 'refractor' &&
      namedIdentityTokens(variantTokens).some(
        (t) =>
          t !== 'refractor' &&
          t !== 'variation' &&
          psaTokens.has(t),
      )
    ) {
      return true;
    }
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
  return chunks.every((c) => {
    if (blobHasVarietyChunk(blob, c)) return true;
    if (
      c === 'variation' &&
      psaVarietyNamesImageVariation(pv) &&
      rowHasImageVariationSpCue(blob)
    ) {
      return true;
    }
    // Same Chrome shorthand: PSA `… REFRACTOR` vs catalog without the word.
    if (
      c === 'refractor' &&
      namedIdentityTokens([...psaTokens]).some(
        (t) =>
          t !== 'refractor' &&
          t !== 'variation' &&
          blobHasVarietyChunk(blob, t),
      )
    ) {
      return true;
    }
    return false;
  });
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
