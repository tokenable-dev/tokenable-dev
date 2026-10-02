/**
 * Cardhedger search vocabulary for known Pokémon set codes.
 *
 * Separate from the display catalog (`pokemon-set-code.catalog.ts`):
 *   catalog:  SV2a → "Pokémon Card 151"   (canonical metadata)
 *   this file: SV2a → "Pokemon Japanese 151" (Cardhedger `row.set` / search)
 *
 * Only add phrases proven by fixtures / evidence. Never invent.
 * Deferred codes (SV1S, SV-P, …) intentionally have no entry.
 */

import { normalizeForExactCatalogMatch } from './card-match.util';

export type PokemonCardhedgerSetPhraseEntry = {
  setCode: string;
  /** Primary Cardhedger `set` / search phrase. */
  primaryPhrase: string;
  /** Optional extra phrases already used as Tokenable aliases. */
  aliasPhrases?: string[];
};

const POKEMON_CARDHEDGER_SET_PHRASES: Record<
  string,
  PokemonCardhedgerSetPhraseEntry
> = {
  SV2A: {
    setCode: 'SV2a',
    primaryPhrase: 'Pokemon Japanese 151',
    // Kept for collection alias token compatibility (`cardhedger-search-alias`).
    aliasPhrases: ['Scarlet Violet 151'],
  },
  // Do not search raw "M2" — collides with sports card numbers.
  M2: {
    setCode: 'M2',
    primaryPhrase: 'Pokemon Japanese Inferno X',
  },
  M2A: {
    setCode: 'M2a',
    primaryPhrase: 'Pokemon Japanese Mega Dream EX',
  },
  // Distinct from JP SV-P (deferred — no phrase).
  SVP: {
    setCode: 'SVP',
    primaryPhrase: 'Pokemon Scarlet Violet Black Star Promos',
    aliasPhrases: ['Scarlet Violet Black Star Promos'],
  },
  SV1V: {
    setCode: 'SV1V',
    primaryPhrase: 'Pokemon Japanese Scarlet & Violet Violet EX',
  },
};

function setCodeKey(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/** Lookup Cardhedger set phrases for a normalized Pokémon setCode. */
export function lookupPokemonCardhedgerSetPhrase(
  setCode: string | null | undefined,
): PokemonCardhedgerSetPhraseEntry | null {
  const key = setCodeKey(setCode);
  if (!key) return null;
  return POKEMON_CARDHEDGER_SET_PHRASES[key] ?? null;
}

/**
 * Primary Cardhedger search phrase for a set code, or null when unknown.
 * Deferred codes (SV1S, SV-P, …) return null — do not invent.
 */
export function pokemonCardhedgerPrimarySetPhrase(
  setCode: string | null | undefined,
): string | null {
  return lookupPokemonCardhedgerSetPhrase(setCode)?.primaryPhrase ?? null;
}

/**
 * Phrases used to match Cardhedger `row.set` for Pokémon mint scoring.
 * Includes PSA set hint + mapped vocabulary only — never canonical display setName
 * (e.g. SV1S "Scarlet ex" must not token-match unrelated EX sets).
 */
export function pokemonCardhedgerMintSetMatchPhrases(input: {
  setCode?: string | null;
  cardSetHint?: string | null;
}): string[] {
  const entry = lookupPokemonCardhedgerSetPhrase(input.setCode);
  return [input.cardSetHint ?? '', entry?.primaryPhrase ?? '', ...(entry?.aliasPhrases ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Whether Cardhedger `row.set` covers a search phrase (substring or distinctive tokens). */
export function setMatchedAgainstPhrase(
  wantPhrase: string,
  rowSet: string,
): boolean {
  const want = normalizeForExactCatalogMatch(wantPhrase);
  const got = normalizeForExactCatalogMatch(rowSet);
  if (!want || !got) return false;
  if (got.includes(want) || want.includes(got)) return true;
  // Live Cardhedger often uses longer set strings, e.g.
  // "2023 Pokemon Japanese Scarlet & Violet 151" vs "Pokemon Japanese 151".
  const tokens =
    String(wantPhrase)
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter(
        (t) =>
          t.length >= 2 && !/^(?:19|20)\d{2}$/.test(t) && t !== 'pokemon',
      ) ?? [];
  if (tokens.length === 0) return false;
  return tokens.every((t) => got.includes(t));
}
