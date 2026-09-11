/**
 * V1 Pokémon metadata normalizer — additive projection only.
 * Does not mutate PSA Brand / card.set / Cardhedger matching inputs.
 */

import { psaVarietyIsPokemonRarityLabel } from '../../psa/psa-variety-catalog.util';
import {
  lookupPokemonSetCodeCatalog,
  normalizePokemonSetCodeKey,
} from './pokemon-set-code.catalog';

export type PokemonNormalizedMetadata = {
  game: 'pokemon';
  language?: string;
  series?: string;
  setName?: string;
  setCode?: string;
  cardName?: string;
  cardNumber?: string;
  variant?: string;
  rarity?: string;
  setKind?: 'expansion' | 'promo' | 'unknown';
};

export type NormalizePokemonMetadataInput = {
  brand?: string | null;
  setHint?: string | null;
  category?: string | null;
  subject?: string | null;
  cardName?: string | null;
  cardNumber?: string | null;
  variety?: string | null;
  /** Explicit language if already known (submission / components). */
  language?: string | null;
  /**
   * Cardhedger `row.set` — hint only. Not used as canonical setName in V1
   * (catalog provides canonical names for known codes).
   */
  cardhedgerSet?: string | null;
};

const LANG_FROM_BRAND: Array<{ re: RegExp; code: string }> = [
  { re: /\bjapanese\b/i, code: 'JP' },
  { re: /\benglish\b/i, code: 'EN' },
  { re: /\bkorean\b/i, code: 'KR' },
  { re: /\bchinese\b/i, code: 'CN' },
  { re: /\bfrench\b/i, code: 'FR' },
  { re: /\bgerman\b/i, code: 'DE' },
  { re: /\bitalian\b/i, code: 'IT' },
  { re: /\bspanish\b/i, code: 'ES' },
];

const SHORT_LANG = /^(EN|JP|KR|CN|FR|DE|IT|ES)$/i;

export type PrintLanguageHints = {
  language?: string | null;
  brand?: string | null;
  setHint?: string | null;
  category?: string | null;
  variety?: string | null;
  cardhedgerSet?: string | null;
};

/**
 * PSA has no Language key. Infer a short code from Brand / Category / Variety
 * (and optional Cardhedger set / catalog market). Works for every TCG — not
 * Pokémon-only. Omit rather than invent English.
 */
export function inferPrintLanguageFromHints(
  input: PrintLanguageHints,
  catalogMarket?: string | null,
): string | undefined {
  const blobs = [
    input.language,
    input.brand,
    input.setHint,
    input.category,
    input.variety,
    input.cardhedgerSet,
  ]
    .map(trimStr)
    .filter(Boolean);

  for (const blob of blobs) {
    if (SHORT_LANG.test(blob)) return blob.toUpperCase();
    for (const { re, code } of LANG_FROM_BRAND) {
      if (re.test(blob)) return code;
    }
  }

  const market = trimStr(catalogMarket);
  if (market && SHORT_LANG.test(market)) return market.toUpperCase();

  return undefined;
}

export function printLanguageHintsFromGraded(
  graded: Record<string, unknown> | null | undefined,
): PrintLanguageHints {
  if (!graded || typeof graded !== 'object') return {};
  const psa =
    graded.psa && typeof graded.psa === 'object'
      ? (graded.psa as Record<string, unknown>)
      : {};
  const card =
    graded.card && typeof graded.card === 'object'
      ? (graded.card as Record<string, unknown>)
      : {};
  const ch =
    graded.cardhedger && typeof graded.cardhedger === 'object'
      ? (graded.cardhedger as Record<string, unknown>)
      : {};
  const normalized =
    graded.normalized && typeof graded.normalized === 'object'
      ? (graded.normalized as Record<string, unknown>)
      : {};
  const pokemon =
    normalized.pokemon && typeof normalized.pokemon === 'object'
      ? (normalized.pokemon as Record<string, unknown>)
      : {};
  return {
    language:
      trimStr(normalized.language) ||
      trimStr(pokemon.language) ||
      trimStr(ch.market) ||
      trimStr(card.market) ||
      null,
    brand: trimStr(psa.brand) || trimStr(psa.Brand) || trimStr(psa.setHint),
    setHint: trimStr(psa.setHint) || trimStr(card.set),
    category: trimStr(psa.category) || trimStr(psa.Category),
    variety:
      trimStr(psa.Variety) ||
      trimStr(psa.variety) ||
      trimStr(psa.varietyHint) ||
      trimStr(card.variant),
    cardhedgerSet:
      trimStr(ch.set) || trimStr(ch.setName) || trimStr(card.set) || null,
  };
}

/** Fill `components.language` when missing (Pokémon and other TCG). */
export function applyPrintLanguageToComponents(
  components: Record<string, unknown>,
  hints: PrintLanguageHints,
  catalogMarket?: string | null,
): void {
  if (trimStr(components.language)) return;
  const lang = inferPrintLanguageFromHints(
    {
      ...hints,
      language: hints.language || trimStr(components.language) || null,
    },
    catalogMarket,
  );
  if (lang) components.language = lang;
}

/**
 * Persist TCG print language on `graded.normalized.language` (alongside
 * optional `normalized.pokemon`). Does not invent English.
 */
export function attachPrintLanguageToGraded(
  graded: Record<string, unknown>,
): string | undefined {
  const prev =
    graded.normalized && typeof graded.normalized === 'object'
      ? { ...(graded.normalized as Record<string, unknown>) }
      : {};
  if (trimStr(prev.language)) {
    return trimStr(prev.language);
  }
  const lang = inferPrintLanguageFromHints(printLanguageHintsFromGraded(graded));
  if (!lang) return undefined;
  graded.normalized = { ...prev, language: lang };
  return lang;
}

/** PSA / Brand set-code tokens: SV2a, SV1S, SV-P, SVP, SWSH045, … */
const SET_CODE_TOKEN =
  /\b([A-Z]{1,4}-?[A-Z]?\d{0,3}[A-Z]?|[A-Z]{2,4}\d+[A-Z]?)\b/gi;

function trimStr(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function looksLikePokemon(input: NormalizePokemonMetadataInput): boolean {
  const blob = [input.brand, input.setHint, input.category, input.cardhedgerSet]
    .map(trimStr)
    .filter(Boolean)
    .join(' ');
  if (!blob) return false;
  if (/pok[eé]mon/i.test(blob)) return true;
  if (/\btcg\b/i.test(blob) && /pok/i.test(blob)) return true;
  // Known set codes alone are not enough without Pokémon context.
  return false;
}

function resolveLanguage(
  input: NormalizePokemonMetadataInput,
  catalogMarket?: string | null,
): string | undefined {
  return inferPrintLanguageFromHints(input, catalogMarket);
}

/**
 * Extract a set-code token from PSA Brand / setHint.
 * Prefers codes that exist in the curated catalog; otherwise first plausible code.
 */
export function extractPokemonSetCodeFromBrand(
  brandOrSet: string | null | undefined,
): string | undefined {
  const raw = trimStr(brandOrSet);
  if (!raw) return undefined;

  // Structured: `… SV2a-POKEMON CARD 151` or `… SV2a POKEMON …`
  const beforeHyphen = /\b([A-Za-z]{1,4}\d+[A-Za-z]?)\s*-\s*/.exec(raw);
  if (beforeHyphen?.[1]) {
    const code = beforeHyphen[1];
    if (lookupPokemonSetCodeCatalog(code)) {
      return lookupPokemonSetCodeCatalog(code)!.setCode;
    }
  }

  const hyphenPromo = /\b(SV-P|SWSH-P|MEP)\b/i.exec(raw);
  if (hyphenPromo?.[1]) {
    const hit = lookupPokemonSetCodeCatalog(hyphenPromo[1]);
    if (hit) return hit.setCode;
  }

  const candidates: string[] = [];
  const re = new RegExp(SET_CODE_TOKEN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) != null) {
    const tok = m[1];
    if (!tok) continue;
    // Skip bare years and pure language words.
    if (/^\d{4}$/.test(tok)) continue;
    if (/^(JP|EN|KR|CN)$/i.test(tok)) continue;
    candidates.push(tok);
  }

  for (const tok of candidates) {
    const hit = lookupPokemonSetCodeCatalog(tok);
    if (hit) return hit.setCode;
  }

  // No catalog hit — only return a code when Brand clearly has CODE- pattern.
  if (beforeHyphen?.[1] && /^[A-Za-z]{1,4}\d+[A-Za-z]?$/.test(beforeHyphen[1])) {
    return beforeHyphen[1];
  }
  return undefined;
}

function titleCaseWords(raw: string): string {
  return raw
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part;
      if (part.length <= 2 && /^(ex|gx|v|sp)$/i.test(part)) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('')
    .replace(/\bHolo\b/g, 'Holo')
    .replace(/\bFoil\b/g, 'Foil');
}

function classifyVariety(varietyRaw: string): {
  variant?: string;
  rarity?: string;
} {
  const v = varietyRaw.trim();
  if (!v) return {};
  if (psaVarietyIsPokemonRarityLabel(v)) {
    return { rarity: titleCaseWords(v.replace(/\s*\/\s*.*$/, '').trim() || v) };
  }
  const lower = v.toLowerCase().replace(/\s+/g, ' ');
  if (
    /\bmaster\s+ball\b/.test(lower) ||
    /\bpoke\s*ball\b/.test(lower) ||
    /\breverse\s+(holo|foil|holofoil)\b/.test(lower)
  ) {
    // Prefer a stable short label for plain reverse holo.
    if (/^reverse\s+(holo|foil|holofoil)$/i.test(v.trim())) {
      return { variant: 'Reverse Holo' };
    }
    if (/\bmaster\s+ball\b.*\breverse\b/i.test(v)) {
      return { variant: 'Master Ball Reverse Holo' };
    }
    return { variant: titleCaseWords(v) };
  }
  return {};
}

/**
 * Normalize Pokémon slab metadata into an additive projection.
 * Returns `null` when the card is not Pokémon (or not identifiable as such).
 */
export function normalizePokemonMetadata(
  input: NormalizePokemonMetadataInput,
): PokemonNormalizedMetadata | null {
  if (!looksLikePokemon(input)) return null;

  const brand = trimStr(input.brand) || trimStr(input.setHint);
  const cardName =
    trimStr(input.subject) || trimStr(input.cardName) || undefined;
  const cardNumber = trimStr(input.cardNumber) || undefined;
  const variety = trimStr(input.variety);

  const out: PokemonNormalizedMetadata = { game: 'pokemon' };

  if (cardName) out.cardName = cardName;
  if (cardNumber) out.cardNumber = cardNumber.replace(/^#/, '');

  const setCode = extractPokemonSetCodeFromBrand(brand);
  const catalog = setCode ? lookupPokemonSetCodeCatalog(setCode) : null;

  const language = resolveLanguage(input, catalog?.market ?? null);
  if (language) out.language = language;

  if (catalog) {
    out.setCode = catalog.setCode;
    if (catalog.series) out.series = catalog.series;
    if (catalog.setName) out.setName = catalog.setName;
    out.setKind = catalog.setKind;
  } else if (setCode) {
    // Recognized token shape but unknown to catalog — keep code only.
    out.setCode = setCode;
    out.setKind = /p$/i.test(normalizePokemonSetCodeKey(setCode))
      ? 'promo'
      : 'unknown';
  } else if (brand && !/^pok[eé]mon$/i.test(brand)) {
    // Brand has more than generic "Pokemon" but no code — kind unknown.
    out.setKind = 'unknown';
  }

  if (variety) {
    const { variant, rarity } = classifyVariety(variety);
    if (variant) out.variant = variant;
    if (rarity) out.rarity = rarity;
  }

  return out;
}

/** Build normalizer input from a graded object (`properties.graded` or root `graded`). */
export function normalizePokemonMetadataFromGraded(
  graded: Record<string, unknown> | null | undefined,
  opts?: { language?: string | null; cardhedgerSet?: string | null },
): PokemonNormalizedMetadata | null {
  if (!graded || typeof graded !== 'object') return null;
  const psa =
    graded.psa && typeof graded.psa === 'object'
      ? (graded.psa as Record<string, unknown>)
      : {};
  const card =
    graded.card && typeof graded.card === 'object'
      ? (graded.card as Record<string, unknown>)
      : {};
  const ch =
    graded.cardhedger && typeof graded.cardhedger === 'object'
      ? (graded.cardhedger as Record<string, unknown>)
      : {};
  return normalizePokemonMetadata({
    brand: trimStr(psa.brand) || trimStr(psa.Brand) || trimStr(psa.setHint),
    setHint: trimStr(psa.setHint),
    category: trimStr(psa.category) || trimStr(psa.Category),
    subject:
      trimStr(psa.subject) ||
      trimStr(psa.Subject) ||
      trimStr(psa.cardNameHint),
    cardName: trimStr(card.name),
    cardNumber: trimStr(card.number) || trimStr(psa.cardNumberHint),
    variety:
      trimStr(psa.Variety) ||
      trimStr(psa.variety) ||
      trimStr(psa.varietyHint) ||
      trimStr(card.variant),
    language:
      opts?.language ||
      trimStr(ch.market) ||
      trimStr(card.market) ||
      null,
    cardhedgerSet:
      opts?.cardhedgerSet ||
      trimStr(ch.set) ||
      trimStr(ch.setName) ||
      trimStr(card.set) ||
      null,
  });
}

/**
 * Attach `graded.normalized.pokemon` when normalization succeeds.
 * Does not modify card.set / psa.* identity fields.
 */
export function attachPokemonNormalizedToGraded(
  graded: Record<string, unknown>,
  opts?: { language?: string | null; cardhedgerSet?: string | null },
): PokemonNormalizedMetadata | null {
  const pokemon = normalizePokemonMetadataFromGraded(graded, opts);
  if (!pokemon) return null;
  const prev =
    graded.normalized && typeof graded.normalized === 'object'
      ? { ...(graded.normalized as Record<string, unknown>) }
      : {};
  graded.normalized = { ...prev, pokemon };
  return pokemon;
}

/** Extract normalized pokemon block from graded/IPFS meta if present. */
export function extractPokemonNormalizedFromMeta(
  meta: Record<string, unknown> | null | undefined,
): PokemonNormalizedMetadata | null {
  if (!meta || typeof meta !== 'object') return null;
  const props = meta.properties as Record<string, unknown> | undefined;
  const graded = (props?.graded ?? meta.graded) as
    | Record<string, unknown>
    | undefined;
  if (!graded || typeof graded !== 'object') return null;
  const normalized = graded.normalized as Record<string, unknown> | undefined;
  const pokemon = normalized?.pokemon;
  if (!pokemon || typeof pokemon !== 'object') return null;
  const g = (pokemon as PokemonNormalizedMetadata).game;
  if (g !== 'pokemon') return null;
  return pokemon as PokemonNormalizedMetadata;
}

/**
 * Mirror `graded.normalized.pokemon` onto collection `components`.
 * Fills `language` / `rarity` (and other missing projection fields) without
 * wiping an existing normalizedPokemon block.
 */
export function applyPokemonNormalizedToComponents(
  components: Record<string, unknown>,
  pokemon: PokemonNormalizedMetadata | null | undefined,
): void {
  if (!pokemon || pokemon.game !== 'pokemon') return;

  const prev = components.normalizedPokemon;
  if (prev && typeof prev === 'object') {
    const p = { ...(prev as PokemonNormalizedMetadata) };
    if (!trimStr(p.language) && pokemon.language) p.language = pokemon.language;
    if (!trimStr(p.rarity) && pokemon.rarity) p.rarity = pokemon.rarity;
    if (!trimStr(p.series) && pokemon.series) p.series = pokemon.series;
    if (!trimStr(p.setName) && pokemon.setName) p.setName = pokemon.setName;
    if (!trimStr(p.setCode) && pokemon.setCode) p.setCode = pokemon.setCode;
    if (!trimStr(p.cardName) && pokemon.cardName) p.cardName = pokemon.cardName;
    if (!trimStr(p.cardNumber) && pokemon.cardNumber) {
      p.cardNumber = pokemon.cardNumber;
    }
    if (!trimStr(p.variant) && pokemon.variant) p.variant = pokemon.variant;
    if (!p.setKind && pokemon.setKind) p.setKind = pokemon.setKind;
    components.normalizedPokemon = p;
  } else {
    components.normalizedPokemon = pokemon;
  }

  const np = components.normalizedPokemon as PokemonNormalizedMetadata;
  if (!trimStr(components.language) && np.language) {
    components.language = np.language;
  }
  if (!trimStr(components.rarity) && np.rarity) {
    components.rarity = np.rarity;
  }
}

export function printLanguageHintsFromComponents(
  components: Record<string, unknown>,
): PrintLanguageHints {
  return {
    language: trimStr(components.language) || null,
    brand: trimStr(components.psaBrand) || trimStr(components.cardSet),
    setHint: trimStr(components.cardSet) || trimStr(components.psaBrand),
    category: trimStr(components.psaCategory),
    variety: trimStr(components.psaVariety) || trimStr(components.variant),
  };
}
