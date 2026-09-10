/**
 * V2 Pokémon Cardhedger matching — shadow evaluation helpers (pure).
 * Observation only: never writes cardhedgerCardId or changes production picks.
 */

import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from './card-match.util';
import { cardhedgerRowMatchesPsaVariety } from './cardhedger-psa-variety.util';
import { pokemonCardhedgerPrimarySetPhrase } from './pokemon-cardhedger-set-phrase.util';
import type { PokemonNormalizedMetadata } from './pokemon-metadata-normalize.util';
import { psaVarietyIsPokemonRarityLabel } from '../../psa/psa-variety-catalog.util';

export type PokemonCardhedgerShadowOutcome =
  | 'same'
  | 'both_fail'
  | 'legacy_only'
  | 'shadow_only'
  | 'conflict';

/** @deprecated Prefer PokemonCardhedgerShadowOutcome */
export type PokemonShadowOutcome = PokemonCardhedgerShadowOutcome;

export type PokemonNormalizedShadowSkipReason =
  | 'not_pokemon'
  | 'insufficient_set_phrase'
  | 'insufficient_identity';

export type PokemonNormalizedShadowQueryPlan = {
  queries: string[];
  setPhrase: string | null;
  finishHint: string | null;
  skipReason?: PokemonNormalizedShadowSkipReason;
};

export type PokemonShadowCandidate = {
  cardId: string;
  set: string;
  number: string;
  name: string;
  variant: string;
  score: number;
  verified: boolean;
  numberMatched: boolean;
  nameMatched: boolean;
  setMatched: boolean;
  varietyMatched: boolean;
  query: string;
};

/** Compact row attrs for conflict diagnosis (no full payload). */
export type PokemonShadowRowDigest = {
  cardId: string;
  set: string | null;
  name: string | null;
  number: string | null;
  variant: string | null;
  year: string | null;
};

/**
 * Aggregation-friendly structured telemetry for shadow evaluations.
 * No cert numbers / raw PSA payloads.
 */
export type PokemonCardhedgerShadowTelemetry = {
  type: 'cardhedger_pokemon_normalized_shadow';
  collectionKey: string;
  outcome: PokemonCardhedgerShadowOutcome | 'skipped';
  skipReason?: PokemonNormalizedShadowSkipReason;
  cardName: string | null;
  cardNumber: string | null;
  year: string | null;
  language: string | null;
  series: string | null;
  setName: string | null;
  setCode: string | null;
  variant: string | null;
  rarity: string | null;
  legacy: {
    cardId: string | null;
    query: string | null;
    verified: boolean;
    confidence: string | null;
  };
  shadow: {
    cardId: string | null;
    query: string | null;
    verified: boolean;
    confidence: string | null;
  };
  normalized: {
    setCode: string | null;
    setName: string | null;
    series: string | null;
    setPhrase: string | null;
    variantPhrase: string | null;
  };
  /**
   * Diagnostic only (does not change outcome): skipped for missing set phrase
   * while legacy resolve was verified — future phrase-map candidate signal.
   */
  legacyOnlyCandidate?: boolean;
  /** Present on conflict (and optionally when both sides have rows). */
  conflict?: {
    legacyRow: PokemonShadowRowDigest | null;
    shadowRow: PokemonShadowRowDigest | null;
  };
};

/**
 * Cardhedger finish vocabulary for search (fixtures: Reverse Foil / Master Ball).
 * PSA Variety remains authoritative for validation via cardhedgerRowMatchesPsaVariety.
 */
export function cardhedgerPokemonFinishSearchHint(
  psaVariety: string | null | undefined,
): string | null {
  const raw = String(psaVariety ?? '').trim();
  if (!raw) return null;
  if (psaVarietyIsPokemonRarityLabel(raw)) return null;
  const lower = raw.toLowerCase().replace(/\s+/g, ' ');
  if (/\bmaster\s+ball\b/.test(lower)) return 'Master Ball';
  if (/\breverse\s+(holo|foil|holofoil)\b/.test(lower)) return 'Reverse Foil';
  return null;
}

/**
 * Build a small deterministic query list from normalized.pokemon + PSA Variety.
 * Query A: name + number + setPhrase + finish
 * Query B: name + number + setPhrase
 */
export function buildPokemonNormalizedCardhedgerQueries(input: {
  pokemon: PokemonNormalizedMetadata | null | undefined;
  psaVariety?: string | null;
}): PokemonNormalizedShadowQueryPlan {
  const pokemon = input.pokemon;
  if (!pokemon || pokemon.game !== 'pokemon') {
    return {
      queries: [],
      setPhrase: null,
      finishHint: null,
      skipReason: 'not_pokemon',
    };
  }

  const cardName = String(pokemon.cardName ?? '').trim();
  const cardNumber = String(pokemon.cardNumber ?? '')
    .trim()
    .replace(/^#/, '');
  if (!cardName || !cardNumber) {
    return {
      queries: [],
      setPhrase: null,
      finishHint: null,
      skipReason: 'insufficient_identity',
    };
  }

  const setPhrase = pokemonCardhedgerPrimarySetPhrase(pokemon.setCode ?? null);
  if (!setPhrase) {
    return {
      queries: [],
      setPhrase: null,
      finishHint: cardhedgerPokemonFinishSearchHint(input.psaVariety),
      skipReason: 'insufficient_set_phrase',
    };
  }

  const finishHint = cardhedgerPokemonFinishSearchHint(input.psaVariety);
  const queries: string[] = [];
  const push = (parts: Array<string | null | undefined>) => {
    const q = parts
      .map((p) => String(p ?? '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (q.length < 4) return;
    if (queries.some((x) => x.toLowerCase() === q.toLowerCase())) return;
    queries.push(q);
  };

  if (finishHint) {
    push([cardName, cardNumber, setPhrase, finishHint]);
  }
  push([cardName, cardNumber, setPhrase]);

  return { queries, setPhrase, finishHint };
}

function nameMatched(wantName: string, rowName: string): boolean {
  const want = normalizeForExactCatalogMatch(wantName);
  const got = normalizeForExactCatalogMatch(rowName);
  if (!want || !got) return false;
  if (got.includes(want) || want.includes(got)) return true;
  const words = want.match(/[a-z0-9]+/g) ?? [];
  return words.length > 0 && words.every((w) => got.includes(w));
}

function setMatchedAgainstPhrase(
  wantPhrase: string,
  rowSet: string,
): boolean {
  const want = normalizeForExactCatalogMatch(wantPhrase);
  const got = normalizeForExactCatalogMatch(rowSet);
  if (!want || !got) return false;
  if (got.includes(want) || want.includes(got)) return true;
  // Live Cardhedger often uses longer set strings, e.g.
  // "2023 Pokemon Japanese Scarlet & Violet 151" vs search phrase
  // "Pokemon Japanese 151". Tokenize the original phrase (spaces intact).
  const tokens = String(wantPhrase)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(
      (t) => t.length >= 2 && !/^(?:19|20)\d{2}$/.test(t) && t !== 'pokemon',
    ) ?? [];
  if (tokens.length === 0) return false;
  return tokens.every((t) => got.includes(t));
}

function yearFromRow(row: Record<string, unknown>): string | null {
  const blob = `${String(row.set ?? '')} ${String(row.description ?? row.name ?? '')}`;
  return blob.match(/\b((?:19|20)\d{2})\b/)?.[1] ?? null;
}

export function digestPokemonShadowRow(
  row: Record<string, unknown> | null | undefined,
): PokemonShadowRowDigest | null {
  if (!row || typeof row !== 'object') return null;
  const cardId = String(row.card_id ?? '').trim();
  if (!cardId) return null;
  const set = String(row.set ?? '').trim() || null;
  const name =
    String(row.description ?? row.name ?? '')
      .trim() || null;
  const number = String(row.number ?? '').trim() || null;
  const variant = String(row.variant ?? '').trim() || null;
  return {
    cardId,
    set,
    name,
    number,
    variant,
    year: yearFromRow(row),
  };
}

/** Score one Cardhedger row against normalized Pokémon + PSA Variety (strict). */
export function scorePokemonNormalizedShadowCandidate(
  row: Record<string, unknown>,
  hints: {
    cardName: string;
    cardNumber: string;
    setPhrase: string;
    psaVariety?: string | null;
  },
  query: string,
): PokemonShadowCandidate | null {
  const cardId = String(row.card_id ?? '').trim();
  if (!cardId) return null;

  const varietyMatched = cardhedgerRowMatchesPsaVariety(
    row,
    hints.psaVariety,
  );
  if (!varietyMatched) {
    return {
      cardId,
      set: String(row.set ?? ''),
      number: String(row.number ?? ''),
      name: String(row.description ?? row.name ?? ''),
      variant: String(row.variant ?? ''),
      score: 0,
      verified: false,
      numberMatched: false,
      nameMatched: false,
      setMatched: false,
      varietyMatched: false,
      query,
    };
  }

  const wantNum = normalizeForExactCardNumberKey(
    primaryCardNumber(hints.cardNumber),
  );
  const gotNum = normalizeForExactCardNumberKey(
    primaryCardNumber(String(row.number ?? '')),
  );
  const numberMatched = Boolean(wantNum && gotNum && wantNum === gotNum);

  const rowName = String(row.description ?? row.name ?? '');
  const nameOk = nameMatched(hints.cardName, rowName);
  const setOk = setMatchedAgainstPhrase(hints.setPhrase, String(row.set ?? ''));

  let score = 0;
  if (numberMatched) score += 100;
  if (setOk) score += 60;
  if (nameOk) score += 50;

  const verified = numberMatched && setOk && nameOk && varietyMatched;

  return {
    cardId,
    set: String(row.set ?? ''),
    number: String(row.number ?? ''),
    name: rowName,
    variant: String(row.variant ?? ''),
    score,
    verified,
    numberMatched,
    nameMatched: nameOk,
    setMatched: setOk,
    varietyMatched,
    query,
  };
}

/** Pick best verified candidate across search pages (Query A then B). */
export function pickPokemonNormalizedShadowCandidate(
  pages: Array<{ query: string; cards: Array<Record<string, unknown>> }>,
  hints: {
    cardName: string;
    cardNumber: string;
    setPhrase: string;
    psaVariety?: string | null;
  },
): PokemonShadowCandidate | null {
  const scored: PokemonShadowCandidate[] = [];
  for (const page of pages) {
    for (const row of page.cards) {
      const c = scorePokemonNormalizedShadowCandidate(row, hints, page.query);
      if (c && c.score > 0) scored.push(c);
    }
  }
  scored.sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified) ||
      b.score - a.score ||
      a.cardId.localeCompare(b.cardId),
  );
  const best = scored[0];
  if (!best || !best.verified) return null;
  return best;
}

export function comparePokemonShadowOutcome(input: {
  legacyId: string | null;
  legacyVerified: boolean;
  shadowId: string | null;
  shadowVerified: boolean;
}): PokemonCardhedgerShadowOutcome {
  const legacyOk = Boolean(input.legacyVerified && input.legacyId);
  const shadowOk = Boolean(input.shadowVerified && input.shadowId);
  if (!legacyOk && !shadowOk) return 'both_fail';
  if (legacyOk && !shadowOk) return 'legacy_only';
  if (!legacyOk && shadowOk) return 'shadow_only';
  if (input.legacyId === input.shadowId) return 'same';
  return 'conflict';
}

/**
 * Production identity is always the legacy resolve result in shadow mode.
 * Explicit helper for regression tests — never prefer shadow.
 */
export function productionCardhedgerIdFromShadowCompare(input: {
  legacyId: string | null;
  shadowId: string | null;
}): string | null {
  void input.shadowId;
  return input.legacyId;
}

export function buildPokemonCardhedgerShadowTelemetry(input: {
  collectionKey: string;
  pokemon: PokemonNormalizedMetadata | null | undefined;
  year?: string | null;
  psaVariety?: string | null;
  plan: PokemonNormalizedShadowQueryPlan;
  legacy: {
    cardId: string | null;
    query: string | null;
    verified: boolean;
    confidence: string | null;
    row?: Record<string, unknown> | null;
  };
  shadow: {
    cardId: string | null;
    query: string | null;
    verified: boolean;
    confidence: string | null;
    row?: Record<string, unknown> | null;
  };
  outcome: PokemonCardhedgerShadowOutcome | 'skipped';
}): PokemonCardhedgerShadowTelemetry {
  const pokemon = input.pokemon;
  const telemetry: PokemonCardhedgerShadowTelemetry = {
    type: 'cardhedger_pokemon_normalized_shadow',
    collectionKey: input.collectionKey,
    outcome: input.outcome,
    ...(input.plan.skipReason ? { skipReason: input.plan.skipReason } : {}),
    cardName: pokemon?.cardName?.trim() || null,
    cardNumber: pokemon?.cardNumber?.trim() || null,
    year: input.year?.trim() || null,
    language: pokemon?.language?.trim() || null,
    series: pokemon?.series?.trim() || null,
    setName: pokemon?.setName?.trim() || null,
    setCode: pokemon?.setCode?.trim() || null,
    variant: pokemon?.variant?.trim() || null,
    rarity: pokemon?.rarity?.trim() || null,
    legacy: {
      cardId: input.legacy.cardId,
      query: input.legacy.query,
      verified: input.legacy.verified,
      confidence: input.legacy.confidence,
    },
    shadow: {
      cardId: input.shadow.cardId,
      query: input.shadow.query,
      verified: input.shadow.verified,
      confidence: input.shadow.confidence,
    },
    normalized: {
      setCode: pokemon?.setCode?.trim() || null,
      setName: pokemon?.setName?.trim() || null,
      series: pokemon?.series?.trim() || null,
      setPhrase: input.plan.setPhrase,
      variantPhrase: input.plan.finishHint,
    },
  };

  if (
    input.outcome === 'skipped' &&
    input.plan.skipReason === 'insufficient_set_phrase' &&
    input.legacy.verified
  ) {
    telemetry.legacyOnlyCandidate = true;
  }

  if (input.outcome === 'conflict') {
    telemetry.conflict = {
      legacyRow: digestPokemonShadowRow(input.legacy.row),
      shadowRow: digestPokemonShadowRow(input.shadow.row),
    };
  }

  return telemetry;
}

/** @deprecated Prefer buildPokemonCardhedgerShadowTelemetry */
export function buildPokemonNormalizedShadowLog(
  input: PokemonCardhedgerShadowTelemetry,
): PokemonCardhedgerShadowTelemetry {
  return input;
}
