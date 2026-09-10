/**
 * Cardhedger search vocabulary for known Pokémon set codes.
 * Separate from V1 display catalog (`pokemon-set-code.catalog.ts`):
 *   V1: SV2a → "Pokémon Card 151"
 *   V2: SV2a → "Pokemon Japanese 151" (Cardhedger `row.set`)
 *
 * Only add phrases proven by fixtures / API evidence. Never invent.
 */

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
    // Existing Tokenable alias — keep for compatibility, not primary search.
    aliasPhrases: ['Scarlet Violet 151'],
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
 * Unknown codes (SV1S, SV1V, SV-P, …) return null — do not invent.
 */
export function pokemonCardhedgerPrimarySetPhrase(
  setCode: string | null | undefined,
): string | null {
  return lookupPokemonCardhedgerSetPhrase(setCode)?.primaryPhrase ?? null;
}
