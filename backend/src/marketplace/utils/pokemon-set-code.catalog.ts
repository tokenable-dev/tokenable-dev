/**
 * Curated Pokémon TCG set-code → canonical metadata.
 * Keep this small and evidence-backed — unknown codes must not invent series/setName.
 */

export type PokemonSetCodeCatalogEntry = {
  /** Official-ish set code as stored on PSA Brand (e.g. SV2a, SV1S, SV-P). */
  setCode: string;
  series?: string;
  /** Canonical expansion / promo set name for `normalized.pokemon.setName`. */
  setName?: string;
  setKind: 'expansion' | 'promo';
  /** Optional market hint (not written to normalized output unless useful later). */
  market?: 'JP' | 'EN' | 'KR' | 'CN';
};

/**
 * Lookup key is uppercase with hyphens preserved (`SV-P`, `SV2A`).
 * `SV2a` / `sv2a` both resolve via normalizeSetCodeKey.
 */
const POKEMON_SET_CODE_CATALOG: Record<string, PokemonSetCodeCatalogEntry> = {
  SV2A: {
    setCode: 'SV2a',
    series: 'Scarlet & Violet',
    setName: 'Pokémon Card 151',
    setKind: 'expansion',
    market: 'JP',
  },
  SV1S: {
    setCode: 'SV1S',
    series: 'Scarlet & Violet',
    setName: 'Scarlet ex',
    setKind: 'expansion',
    market: 'JP',
  },
  SV1V: {
    setCode: 'SV1V',
    series: 'Scarlet & Violet',
    setName: 'Violet ex',
    setKind: 'expansion',
    market: 'JP',
  },
  'SV-P': {
    setCode: 'SV-P',
    setKind: 'promo',
    market: 'JP',
  },
  SVP: {
    setCode: 'SVP',
    setKind: 'promo',
    market: 'EN',
  },
};

/** Normalize a raw code token for catalog lookup (`sv2a` → `SV2A`, `sv-p` → `SV-P`). */
export function normalizePokemonSetCodeKey(raw: string): string {
  const t = String(raw ?? '').trim();
  if (!t) return '';
  // Keep hyphenated promo codes; uppercase letters/digits.
  return t.replace(/\s+/g, '').toUpperCase();
}

export function lookupPokemonSetCodeCatalog(
  setCode: string | null | undefined,
): PokemonSetCodeCatalogEntry | null {
  const key = normalizePokemonSetCodeKey(setCode ?? '');
  if (!key) return null;
  return POKEMON_SET_CODE_CATALOG[key] ?? null;
}

export function listPokemonSetCodeCatalogEntries(): PokemonSetCodeCatalogEntry[] {
  const seen = new Set<string>();
  const out: PokemonSetCodeCatalogEntry[] = [];
  for (const entry of Object.values(POKEMON_SET_CODE_CATALOG)) {
    const k = normalizePokemonSetCodeKey(entry.setCode);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(entry);
  }
  return out;
}
